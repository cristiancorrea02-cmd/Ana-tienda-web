import { readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAIZ = path.resolve(__dirname, '../..');
// Las fotos originales (pesadas, no se suben a GitHub) pueden estar en la raíz del proyecto o dentro de backend/.
const carpetasOrigen = [path.resolve(RAIZ, 'imagenes-originales'), path.resolve(__dirname, '../imagenes-originales')];
const ORIGEN = carpetasOrigen.find(existsSync) || carpetasOrigen[0];
const DESTINO = path.resolve(__dirname, '../../frontend/public/productos');
const SALIDA_JSON = path.resolve(__dirname, '../data/productos.json');

// Todas las imágenes salen en formato vertical 4:5 para que la cuadrícula se vea pareja.
const ANCHO = 640;
const ALTO = 800;
const CALIDAD = 78;

const EXTENSIONES = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// "Café Molido" -> "cafe-molido" (sin tildes, para nombres de archivo y IDs seguros)
function slug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatearNombre(texto) {
  let n = texto.replace(/\s+/g, ' ').trim();
  // Si viene todo en mayúsculas ("DESODORANTE LADY SPEED STICK"), pasa a Título
  if (n === n.toUpperCase() && n !== n.toLowerCase()) {
    n = n.toLowerCase().replace(/(^|\s)(\S)/g, (_, esp, letra) => esp + letra.toUpperCase());
  }
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// Unidades de venta que pueden ir entre el nombre y el precio ("Tomates la libra $1700")
const UNIDADES = ['la libra', 'el kilo', 'la docena', 'el litro'];

function separarUnidad(texto) {
  const minusculas = texto.toLowerCase();
  for (const u of UNIDADES) {
    if (minusculas.endsWith(' ' + u)) return [texto.slice(0, -(u.length + 1)).trim(), u];
  }
  return [texto, undefined];
}

// "Aceite Grande $9000"          -> { nombre: "Aceite Grande", precio: 9000 }
// "Tomates la libra $1700"       -> { nombre: "Tomates", precio: 1700, unidad: "la libra" }
// "Tomates $1700 la libra"       -> igual que el anterior (también se acepta)
// "Crispetas 2000" (sin $) se acepta, pero se avisa.
function leerNombreArchivo(base) {
  const conSimbolo = base.match(/^(.+?)\s*\$\s*(\d{3,6})(?:\s+(.+))?$/);
  if (conSimbolo) {
    const [, textoNombre, precio, unidadDespues] = conSimbolo;
    const [nombre, unidadAntes] = separarUnidad(textoNombre.trim());
    const unidad = unidadAntes || (unidadDespues ? unidadDespues.trim().toLowerCase() : undefined);
    return { nombre: formatearNombre(nombre), precio: Number(precio), unidad };
  }
  const sinSimbolo = base.match(/^(.+?)\s+(\d{3,6})$/);
  if (sinSimbolo) {
    const [nombre, unidad] = separarUnidad(sinSimbolo[1].trim());
    return {
      nombre: formatearNombre(nombre),
      precio: Number(sinSimbolo[2]),
      unidad,
      aviso: 'no tiene el símbolo $ en el nombre del archivo',
    };
  }
  return null;
}

// Foto -> WebP 640x800 sin recortar el producto:
// la foto entra completa y el espacio sobrante se rellena con una versión difuminada de la misma foto.
// Los bordes de la foto se desvanecen un poco para que la unión con el relleno no se note.
const SUAVIZADO = 28; // píxeles

async function suavizarBordes(buffer) {
  const { width: w, height: h } = await sharp(buffer).metadata();
  const lateral = w < ANCHO; // sobran barras a los lados
  const vertical = h < ALTO; // sobran barras arriba y abajo
  if (!lateral && !vertical) return buffer;

  const largo = lateral ? w : h;
  const f = Math.min(SUAVIZADO, largo / 2) / largo;
  const [x2, y2] = lateral ? [1, 0] : [0, 1];
  const mascara = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="${x2}" y2="${y2}">` +
      `<stop offset="0" stop-color="#fff" stop-opacity="0"/>` +
      `<stop offset="${f}" stop-color="#fff" stop-opacity="1"/>` +
      `<stop offset="${1 - f}" stop-color="#fff" stop-opacity="1"/>` +
      `<stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
      `</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
  return sharp(buffer).ensureAlpha().composite([{ input: mascara, blend: 'dest-in' }]).png().toBuffer();
}

async function convertir(entrada, salida) {
  const base = sharp(entrada).rotate();
  const fondo = await base.clone().resize(ANCHO, ALTO, { fit: 'cover' }).blur(20).toBuffer();
  const frente = await base.clone().resize(ANCHO, ALTO, { fit: 'inside' }).toBuffer();
  await sharp(fondo)
    .composite([{ input: await suavizarBordes(frente), gravity: 'centre' }])
    .webp({ quality: CALIDAD })
    .toFile(salida);
}

async function enChunks(lista, tamano, fn) {
  for (let i = 0; i < lista.length; i += tamano) {
    await Promise.all(lista.slice(i, i + tamano).map(fn));
  }
}

async function main() {
  if (!existsSync(ORIGEN)) {
    console.error(`No existe la carpeta "${ORIGEN}".`);
    console.error('Crea esa carpeta y dentro una subcarpeta por categoría con las fotos (ej. Bebidas, Mercado).');
    process.exit(1);
  }

  const carpetas = (await readdir(ORIGEN, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, 'es'));

  await rm(DESTINO, { recursive: true, force: true });

  const productos = [];
  const avisos = [];
  const errores = [];
  const trabajos = [];

  for (const carpeta of carpetas) {
    const categoria = carpeta.trim();
    const catSlug = slug(categoria);
    const usados = new Set();
    const archivos = (await readdir(path.join(ORIGEN, carpeta)))
      .filter((f) => EXTENSIONES.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'es'));

    await mkdir(path.join(DESTINO, catSlug), { recursive: true });

    for (const archivo of archivos) {
      const base = path.basename(archivo, path.extname(archivo));
      const datos = leerNombreArchivo(base);
      if (!datos) {
        errores.push(`${carpeta}/${archivo}: no se pudo leer el precio`);
        continue;
      }
      if (datos.aviso) avisos.push(`${carpeta}/${archivo}: ${datos.aviso}`);

      // Nombre de archivo e ID únicos dentro de la categoría
      let nombreSlug = slug(datos.nombre);
      let contador = 2;
      while (usados.has(nombreSlug)) nombreSlug = `${slug(datos.nombre)}-${contador++}`;
      usados.add(nombreSlug);

      const producto = {
        id: `${catSlug}-${nombreSlug}`,
        nombre: datos.nombre,
        precio: datos.precio,
        categoria,
        ...(datos.unidad ? { unidad: datos.unidad } : {}),
        imagen: `/productos/${catSlug}/${nombreSlug}.webp`,
      };
      productos.push(producto);
      trabajos.push({
        entrada: path.join(ORIGEN, carpeta, archivo),
        salida: path.join(DESTINO, catSlug, `${nombreSlug}.webp`),
      });
    }
  }

  console.log(`Procesando ${trabajos.length} imágenes...`);
  await enChunks(trabajos, 6, (t) => convertir(t.entrada, t.salida));

  productos.sort(
    (a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'),
  );
  await mkdir(path.dirname(SALIDA_JSON), { recursive: true });
  await writeFile(SALIDA_JSON, JSON.stringify(productos, null, 2) + '\n', 'utf-8');

  const porCategoria = {};
  for (const p of productos) porCategoria[p.categoria] = (porCategoria[p.categoria] || 0) + 1;
  console.log('\nProductos por categoría:');
  for (const [cat, n] of Object.entries(porCategoria)) console.log(`  ${cat}: ${n}`);
  console.log(`  Total: ${productos.length}`);
  console.log(`\nGenerado: ${SALIDA_JSON}`);

  if (avisos.length) {
    console.log('\nAvisos:');
    avisos.forEach((a) => console.log('  - ' + a));
  }
  if (errores.length) {
    console.log('\nArchivos que NO se procesaron:');
    errores.forEach((e) => console.log('  - ' + e));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
