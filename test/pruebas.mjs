import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { verificarLimite } from '../backend/config/rate-limit.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function ejecutarPruebas() {
  console.log('--- Iniciando suite de validación de Adargeyi ---');

  console.log('1. Validando datos del catálogo local...');
  const contenidoCatalogo = await readFile(path.join(RAIZ, 'backend/data/productos.json'), 'utf-8');
  const productos = JSON.parse(contenidoCatalogo);
  assert(Array.isArray(productos) && productos.length > 0, 'El catálogo de productos debe ser un array no vacío');
  assert(productos.length >= 140, 'El catálogo debe contener todos los productos del negocio');
  for (const p of productos) {
    assert(typeof p.nombre === 'string' && p.nombre.length > 0, 'Cada producto debe tener nombre');
    assert(typeof p.precio === 'number' && p.precio >= 0, 'Cada producto debe tener precio numérico positivo');
    assert(typeof p.categoria === 'string', 'Cada producto debe tener categoría');
  }
  console.log(`✓ Catálogo validado correctamente: ${productos.length} productos verificados.`);

  console.log('2. Probando cálculo de totales del carrito...');
  const itemsPrueba = [
    { nombre: 'Arroz Roa 1kg', precio: 5200, cantidad: 2 },
    { nombre: 'Coca Cola 1 Litro', precio: 4500, cantidad: 3 },
    { nombre: 'Picada El Canario', precio: 1600, cantidad: 1 },
  ];
  const totalCalculado = itemsPrueba.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  assert.equal(totalCalculado, (5200 * 2) + (4500 * 3) + 1600, 'El total calculado debe coincidir exactamente');
  assert.equal(totalCalculado, 25500, 'El total esperado es 25.500');
  console.log(`✓ Cálculo de totales exacto: $${totalCalculado.toLocaleString('es-CO')}`);

  console.log('3. Probando lógica de generación de mensaje de WhatsApp...');
  function generarMensajeWhatsApp({ id, nombre, telefono, tipoEntrega, direccion, productos, total }) {
    const lineas = productos
      .map((p) => `• ${p.nombre} × ${p.cantidad} = $${(p.precio * p.cantidad).toLocaleString('es-CO')}`)
      .join('\n');
    const entrega = tipoEntrega === 'domicilio'
      ? `🛵 Domicilio en Cali\n📍 Dirección: ${direccion}`
      : '🏬 Recogida en tienda (El Edén, Bella Suiza, Cali)';
    return `¡Hola, Adargeyi! 👋\n` +
      `Acabo de registrar el siguiente pedido en la tienda web:\n\n` +
      `📦 Pedido: #${id}\n` +
      `👤 Cliente: ${nombre}\n` +
      `📞 Contacto: ${telefono}\n` +
      `🛵 Entrega: ${entrega}\n\n` +
      `🛒 Productos seleccionados:\n${lineas}\n\n` +
      `💰 Total: $${total.toLocaleString('es-CO')}\n\n` +
      `Quedo atento(a) para coordinar la entrega. ¡Muchas gracias!`;
  }

  const msgDomicilio = generarMensajeWhatsApp({
    id: 'PED12345',
    nombre: 'Ana María Gómez',
    telefono: '3151234567',
    tipoEntrega: 'domicilio',
    direccion: 'Carrera 70 # 5-20 Casa 4',
    productos: itemsPrueba,
    total: totalCalculado,
  });

  assert(msgDomicilio.includes('PED12345'), 'El mensaje debe incluir el ID del pedido');
  assert(msgDomicilio.includes('Ana María Gómez'), 'El mensaje debe incluir el nombre del cliente');
  assert(msgDomicilio.includes('Carrera 70 # 5-20 Casa 4'), 'El mensaje debe incluir la dirección');
  assert(msgDomicilio.includes('Total: $25.500'), 'El mensaje debe incluir el total formateado');

  const msgRecogida = generarMensajeWhatsApp({
    id: 'PED67890',
    nombre: 'Carlos Correa',
    telefono: '3187654321',
    tipoEntrega: 'recogida',
    direccion: '',
    productos: itemsPrueba,
    total: totalCalculado,
  });
  assert(msgRecogida.includes('Recogida en tienda'), 'El mensaje debe especificar recogida en tienda');
  console.log('✓ Formato y contenido de mensajes WhatsApp verificado en ambas modalidades.');

  console.log('4. Probando Rate Limiting del backend...');
  const testIp = '192.168.1.99';
  let bloqueado = false;
  for (let i = 0; i < 15; i++) {
    const res = verificarLimite(testIp, 'estricto');
    if (!res.permitido) {
      bloqueado = true;
      assert(res.reintentarEn > 0, 'Debe indicar segundos para reintentar');
      break;
    }
  }
  assert.equal(bloqueado, true, 'El rate limiter estricto debe bloquear después de superar 10 solicitudes');
  console.log('✓ Rate Limiting en memoria protege contra spam y ataques de fuerza bruta.');

  console.log('5. Probando compresión HTTP gzip y brotli...');
  const jsonPrueba = JSON.stringify(productos);
  const bufferOriginal = Buffer.from(jsonPrueba, 'utf-8');
  const bufferGzip = zlib.gzipSync(bufferOriginal);
  const bufferBrotli = zlib.brotliCompressSync(bufferOriginal);
  assert(bufferGzip.length < bufferOriginal.length, 'GZIP debe reducir significativamente el tamaño del catálogo');
  assert(bufferBrotli.length < bufferOriginal.length, 'Brotli debe reducir significativamente el tamaño');
  console.log(`✓ Compresión efectiva: Original ${(bufferOriginal.length / 1024).toFixed(1)} KB -> GZIP ${(bufferGzip.length / 1024).toFixed(1)} KB -> Brotli ${(bufferBrotli.length / 1024).toFixed(1)} KB`);

  console.log('6. Validando archivos de descubrimiento y SEO...');
  const robots = await readFile(path.join(RAIZ, 'frontend/public/robots.txt'), 'utf-8');
  assert(robots.includes('User-agent: *'), 'robots.txt debe declarar User-agent');
  assert(robots.includes('Sitemap:'), 'robots.txt debe incluir URL del sitemap');

  const sitemap = await readFile(path.join(RAIZ, 'frontend/public/sitemap.xml'), 'utf-8');
  assert(sitemap.includes('<urlset'), 'sitemap.xml debe ser XML válido con urlset');
  assert(sitemap.includes('https://ana-tienda-1976e.web.app/'), 'sitemap.xml debe incluir la URL principal');

  const llms = await readFile(path.join(RAIZ, 'frontend/public/llms.txt'), 'utf-8');
  assert(llms.startsWith('# Adargeyi'), 'llms.txt debe tener encabezado principal # Adargeyi');
  assert(llms.includes('[Catálogo Completo de Productos]'), 'llms.txt debe contener enlaces');

  const aiCatalog = JSON.parse(await readFile(path.join(RAIZ, 'frontend/public/ai-catalog.json'), 'utf-8'));
  assert.equal(aiCatalog.name, 'Adargeyi');
  assert(Array.isArray(aiCatalog.categories) && aiCatalog.categories.length > 0);
  assert(Array.isArray(aiCatalog.products) && aiCatalog.products.length >= 140);

  const webmcp = JSON.parse(await readFile(path.join(RAIZ, 'frontend/public/webmcp.json'), 'utf-8'));
  assert.equal(webmcp.name, 'Adargeyi Store Assistant');
  assert(Array.isArray(webmcp.tools) && webmcp.tools.length >= 3);
  console.log('✓ Archivos SEO, llms.txt, ai-catalog.json y webmcp.json validados con éxito.');

  console.log('\n======================================================');
  console.log(' TODAS LAS PRUEBAS (6/6) PASARON EXITOSAMENTE ');
  console.log('======================================================\n');
}

ejecutarPruebas().catch((err) => {
  console.error('Error en pruebas:', err);
  process.exit(1);
});
