import { montarCatalogo } from './catalogo.js';
import { iniciarBotonAcceso } from './auth/boton-acceso.js';

const filtros = document.getElementById('filtros-categorias');
const lista = document.getElementById('lista-productos');

async function cargarCatalogo() {
  lista.setAttribute('aria-busy', 'true');
  lista.textContent = 'Cargando productos…';
  try {
    const { obtenerProductos } = await import('./services/productos.js');
    const productos = await obtenerProductos();

    if (productos.length === 0) {
      lista.textContent = 'Aún no hay productos en el catálogo.';
      return;
    }
    montarCatalogo({ filtros, lista, productos });
  } catch (error) {
    console.error('No se pudo cargar el catálogo:', error);
    const aviso = document.createElement('p');
    aviso.className = 'text-sm font-medium text-error';
    aviso.setAttribute('role', 'alert');
    aviso.textContent = error.message || 'No pudimos cargar el catálogo. Inténtalo de nuevo.';

    const reintentar = document.createElement('button');
    reintentar.type = 'button';
    reintentar.className = 'mt-3 rounded-full border border-control px-4 py-2 text-sm font-medium hover:border-acento hover:text-acento focus-visible:ring-2 focus-visible:ring-acento';
    reintentar.textContent = 'Intentar de nuevo';
    reintentar.addEventListener('click', cargarCatalogo);
    lista.replaceChildren(aviso, reintentar);
  } finally {
    lista.setAttribute('aria-busy', 'false');
  }
}

iniciarBotonAcceso();
cargarCatalogo();
