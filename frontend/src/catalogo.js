const formatoPrecio = (n) => '$' + Number(n).toLocaleString('es-CO');

const BOTON_BASE = 'px-4 py-2 rounded-full text-sm font-medium border transition focus-visible:ring-2 focus-visible:ring-acento focus-visible:outline-none';
const BOTON_ACTIVO = 'bg-acento text-white border-acento shadow-sm';
const BOTON_INACTIVO = 'bg-white text-tinta border-control hover:border-acento hover:text-acento';

function crearTarjeta(p) {
  const tarjeta = document.createElement('article');
  tarjeta.className =
    'bg-superficie rounded-3xl p-3 sm:p-4 shadow-xs hover:shadow-md transition duration-300 flex flex-col group border border-borde/70';

  const marco = document.createElement('div');
  marco.className = 'aspect-4/5 rounded-2xl overflow-hidden bg-hielo mb-3 sm:mb-4';

  const img = document.createElement('img');
  img.src = p.imagen;
  img.alt = p.nombre;
  img.width = 640;
  img.height = 800;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.className = 'w-full h-full object-cover group-hover:scale-105 transition duration-500';
  img.onerror = () => {
    img.onerror = null; // evita un bucle si el ícono de respaldo también fallara
    img.src = '/icon-192.png';
  };
  marco.appendChild(img);

  const info = document.createElement('div');
  info.className = 'px-1 sm:px-2 pb-1 sm:pb-2';

  const nombre = document.createElement('h4');
  nombre.className = 'font-serif-custom text-base sm:text-lg font-semibold leading-snug text-tinta';
  nombre.textContent = p.nombre;

  if (p.unidad) {
    const unidad = document.createElement('span');
    unidad.className = 'text-sm font-normal text-tinta-suave';
    unidad.textContent = ' ' + p.unidad;
    nombre.appendChild(unidad);
  }

  const precio = document.createElement('p');
  precio.className = 'text-acento font-bold mt-1.5 text-base sm:text-lg';
  precio.textContent = formatoPrecio(p.precio);

  info.append(nombre, precio);
  tarjeta.append(marco, info);
  return tarjeta;
}

function crearSeccion(categoria, productos) {
  const seccion = document.createElement('section');

  const titulo = document.createElement('h3');
  titulo.className = 'font-serif-custom text-2xl font-semibold mb-6';
  titulo.textContent = categoria;

  const grilla = document.createElement('div');
  grilla.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6';
  grilla.append(...productos.map(crearTarjeta));

  seccion.append(titulo, grilla);
  return seccion;
}

export function montarCatalogo({ filtros, lista, productos }) {
  const orden = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' });

  const grupos = new Map();
  for (const p of productos) {
    const cat = p.categoria || 'Otros';
    if (!grupos.has(cat)) grupos.set(cat, []);
    grupos.get(cat).push(p);
  }
  const categorias = [...grupos.keys()].sort(orden);

  const secciones = new Map();
  for (const cat of categorias) {
    grupos.get(cat).sort((a, b) => orden(a.nombre, b.nombre));
    secciones.set(cat, crearSeccion(cat, grupos.get(cat)));
  }

  const botones = new Map();
  const opciones = [['Todos', productos.length], ...categorias.map((c) => [c, grupos.get(c).length])];

  function seleccionar(activa) {
    for (const [cat, seccion] of secciones) seccion.hidden = !(activa === 'Todos' || activa === cat);
    for (const [cat, boton] of botones) {
      const on = cat === activa;
      boton.className = `${BOTON_BASE} ${on ? BOTON_ACTIVO : BOTON_INACTIVO}`;
      boton.setAttribute('aria-pressed', String(on));
    }
  }

  for (const [cat, cantidad] of opciones) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = `${cat} (${cantidad})`;
    boton.addEventListener('click', () => seleccionar(cat));
    botones.set(cat, boton);
  }

  filtros.replaceChildren(...botones.values());
  lista.replaceChildren(...secciones.values());
  seleccionar('Todos');
}
