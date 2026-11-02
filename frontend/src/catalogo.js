const formatoPrecio = (n) => '$' + Number(n).toLocaleString('es-CO');

const BOTON_BASE = 'px-4 py-2 rounded-full text-sm font-medium border transition focus-visible:ring-2 focus-visible:ring-acento focus-visible:outline-none';
const BOTON_ACTIVO = 'bg-acento text-white border-acento shadow-sm';
const BOTON_INACTIVO = 'bg-white text-tinta border-control hover:border-acento hover:text-acento';

const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');

function claveProducto(producto) {
  return String(producto.id ?? `${producto.categoria || 'Otros'}-${producto.nombre}`);
}

function crearTarjeta(producto) {
  const tarjeta = document.createElement('article');
  tarjeta.className =
    'bg-superficie rounded-3xl p-3 sm:p-4 shadow-xs hover:shadow-md transition duration-300 flex flex-col group border border-borde/70';

  const marco = document.createElement('div');
  marco.className = 'aspect-4/5 rounded-2xl overflow-hidden bg-hielo mb-3 sm:mb-4';

  const img = document.createElement('img');
  img.src = producto.imagen || '/icon-192.png';
  img.alt = producto.nombre || 'Producto';
  img.width = 640;
  img.height = 800;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.className = 'w-full h-full object-cover group-hover:scale-105 transition duration-500';
  img.onerror = () => {
    img.onerror = null;
    img.src = '/icon-192.png';
  };
  marco.appendChild(img);

  const info = document.createElement('div');
  info.className = 'px-1 sm:px-2 pb-1 sm:pb-2 flex-1';

  const nombre = document.createElement('h4');
  nombre.className = 'font-serif-custom text-base sm:text-lg font-semibold leading-snug text-tinta';
  nombre.textContent = producto.nombre || 'Producto sin nombre';

  if (producto.unidad) {
    const unidad = document.createElement('span');
    unidad.className = 'text-sm font-normal text-tinta-suave';
    unidad.textContent = ' ' + producto.unidad;
    nombre.appendChild(unidad);
  }

  const precio = document.createElement('p');
  precio.className = 'text-acento font-bold mt-1.5 text-base sm:text-lg';
  precio.textContent = formatoPrecio(producto.precio);

  const agregar = document.createElement('button');
  agregar.type = 'button';
  agregar.dataset.productId = claveProducto(producto);
  agregar.className =
    'mt-4 w-full rounded-full border border-acento px-4 py-2 text-sm font-medium text-acento transition hover:bg-acento hover:text-white focus-visible:ring-2 focus-visible:ring-acento';
  agregar.textContent = 'Agregar al carrito';

  info.append(nombre, precio);
  tarjeta.append(marco, info, agregar);
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

function configurarCarrito(productos) {
  const abrir = document.getElementById('open-cart');
  const cerrar = document.getElementById('close-cart');
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  const items = document.getElementById('cart-items');
  const badge = document.getElementById('cart-badge');
  const subtotal = document.getElementById('cart-subtotal');
  const enlaceUbicacion = document.getElementById('cart-location');
  const porId = new Map(productos.map((producto) => [claveProducto(producto), producto]));
  const carrito = new Map();
  let focoAnterior = null;
  let overflowAnterior = '';

  function cerrarCarrito(restaurarFoco = true) {
    drawer.classList.add('translate-x-full');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    overlay.classList.add('hidden');
    abrir.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = overflowAnterior;
    if (restaurarFoco && focoAnterior instanceof HTMLElement) focoAnterior.focus();
  }

  function abrirCarrito() {
    focoAnterior = document.activeElement;
    overflowAnterior = document.body.style.overflow;
    drawer.classList.remove('translate-x-full');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.removeAttribute('inert');
    overlay.classList.remove('hidden');
    abrir.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    cerrar.focus();
  }

  function renderizarCarrito() {
    const cantidadTotal = [...carrito.values()].reduce((suma, item) => suma + item.cantidad, 0);
    badge.textContent = String(cantidadTotal);
    badge.classList.toggle('hidden', cantidadTotal === 0);
    badge.classList.toggle('flex', cantidadTotal > 0);
    abrir.setAttribute(
      'aria-label',
      `Carrito de compras, ${cantidadTotal} ${cantidadTotal === 1 ? 'producto' : 'productos'}`,
    );

    if (carrito.size === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'py-8 text-center text-tinta-suave';
      vacio.textContent = 'Tu carrito está vacío. Agrega productos del catálogo para verlos aquí.';
      items.replaceChildren(vacio);
    } else {
      const filas = [];
      for (const [id, item] of carrito) {
        const fila = document.createElement('article');
        fila.className = 'grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-borde py-4';

        const imagen = document.createElement('img');
        imagen.src = item.producto.imagen || '/icon-192.png';
        imagen.alt = '';
        imagen.className = 'h-14 w-14 rounded-xl bg-hielo object-cover';
        imagen.onerror = () => {
          imagen.onerror = null;
          imagen.src = '/icon-192.png';
        };

        const info = document.createElement('div');
        info.className = 'min-w-0';
        const nombre = document.createElement('h3');
        nombre.className = 'break-words text-sm font-semibold';
        nombre.textContent = item.producto.nombre || 'Producto sin nombre';
        const precio = document.createElement('p');
        precio.className = 'mt-1 text-sm font-semibold text-acento';
        precio.textContent = formatoPrecio(item.producto.precio);

        const controles = document.createElement('div');
        controles.className = 'mt-2 inline-flex items-center gap-3 rounded-full border border-control px-2 py-1';
        const restar = document.createElement('button');
        restar.type = 'button';
        restar.dataset.action = 'restar';
        restar.dataset.productId = id;
        restar.setAttribute('aria-label', `Restar una unidad de ${nombre.textContent}`);
        restar.className = 'w-5 font-semibold';
        restar.textContent = '−';
        const cantidad = document.createElement('span');
        cantidad.textContent = String(item.cantidad);
        const sumar = document.createElement('button');
        sumar.type = 'button';
        sumar.dataset.action = 'sumar';
        sumar.dataset.productId = id;
        sumar.setAttribute('aria-label', `Agregar una unidad de ${nombre.textContent}`);
        sumar.className = 'w-5 font-semibold';
        sumar.textContent = '+';
        controles.append(restar, cantidad, sumar);
        info.append(nombre, precio, controles);

        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.dataset.action = 'quitar';
        quitar.dataset.productId = id;
        quitar.className = 'text-xs text-tinta-suave underline hover:text-acento';
        quitar.textContent = 'Quitar';
        fila.append(imagen, info, quitar);
        filas.push(fila);
      }
      items.replaceChildren(...filas);
    }

    const total = [...carrito.values()].reduce(
      (suma, item) => suma + Number(item.producto.precio || 0) * item.cantidad,
      0,
    );
    subtotal.textContent = formatoPrecio(total);
  }

  abrir.addEventListener('click', abrirCarrito);
  cerrar.addEventListener('click', () => cerrarCarrito());
  overlay.addEventListener('click', () => cerrarCarrito());
  enlaceUbicacion.addEventListener('click', () => cerrarCarrito(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.getAttribute('aria-hidden') === 'false') cerrarCarrito();
  });

  items.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const boton = event.target.closest('button[data-action]');
    if (!boton) return;
    const id = boton.dataset.productId;
    const item = carrito.get(id);
    if (!item) return;

    if (boton.dataset.action === 'sumar') item.cantidad += 1;
    if (boton.dataset.action === 'restar') item.cantidad -= 1;
    if (boton.dataset.action === 'quitar' || item.cantidad <= 0) carrito.delete(id);
    renderizarCarrito();
  });

  const botonHacerPedido = document.getElementById('cart-submit-order');
  const inputClienteNombre = document.getElementById('cart-client-name');
  const inputClienteTelefono = document.getElementById('cart-client-phone');
  const statusPedido = document.getElementById('cart-order-status');

  async function enviarPedido() {
    if (carrito.size === 0) {
      if (statusPedido) {
        statusPedido.textContent = 'El carrito está vacío.';
        statusPedido.className = 'text-xs text-center font-medium min-h-4 text-error';
      }
      return;
    }

    const nombre = (inputClienteNombre?.value || '').trim() || 'Cliente anónimo';
    const telefono = (inputClienteTelefono?.value || '').trim();
    const productosPedido = [...carrito.values()].map((i) => ({
      nombre: i.producto.nombre || 'Producto',
      cantidad: i.cantidad,
      precio: i.producto.precio || 0,
    }));
    const total = productosPedido.reduce((acc, p) => acc + p.precio * p.cantidad, 0);

    if (botonHacerPedido) {
      botonHacerPedido.disabled = true;
      botonHacerPedido.textContent = 'Enviando pedido…';
    }
    if (statusPedido) {
      statusPedido.textContent = '';
    }

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteNombre: nombre,
          clienteTelefono: telefono,
          productos: productosPedido,
          total,
        }),
      });

      if (!res.ok) throw new Error('No se pudo registrar el pedido');

      carrito.clear();
      renderizarCarrito();
      if (inputClienteNombre) inputClienteNombre.value = '';
      if (inputClienteTelefono) inputClienteTelefono.value = '';

      if (statusPedido) {
        statusPedido.textContent = '¡Pedido recibido con éxito! El administrador lo atenderá.';
        statusPedido.className = 'text-xs text-center font-medium min-h-4 text-exito';
      }
    } catch (err) {
      console.error('Error enviando pedido:', err);
      if (statusPedido) {
        statusPedido.textContent = 'Error al enviar el pedido. Intenta nuevamente.';
        statusPedido.className = 'text-xs text-center font-medium min-h-4 text-error';
      }
    } finally {
      if (botonHacerPedido) {
        botonHacerPedido.disabled = false;
        botonHacerPedido.textContent = 'Confirmar y realizar pedido';
      }
    }
  }

  if (botonHacerPedido) {
    botonHacerPedido.addEventListener('click', enviarPedido);
  }

  return {
    agregar(id) {
      const producto = porId.get(id);
      if (!producto) return;
      const item = carrito.get(id);
      if (item) item.cantidad += 1;
      else carrito.set(id, { producto, cantidad: 1 });
      renderizarCarrito();
      abrirCarrito();
    },
  };
}

export function montarCatalogo({ filtros, lista, busqueda, productos }) {
  const ordenar = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' });
  const categorias = [...new Set(productos.map((producto) => producto.categoria || 'Otros'))].sort(ordenar);
  const carrito = configurarCarrito(productos);
  let categoriaActiva = 'Todos';

  function renderizar() {
    const terminos = normalizar(busqueda.value).trim().split(/\s+/).filter(Boolean);
    const coinciden = productos.filter((producto) => {
      const contenido = normalizar(
        `${producto.nombre || ''} ${producto.categoria || 'Otros'} ${producto.unidad || ''}`,
      );
      return terminos.every((termino) => contenido.includes(termino));
    });

    const conteos = new Map(categorias.map((categoria) => [
      categoria,
      coinciden.filter((producto) => (producto.categoria || 'Otros') === categoria).length,
    ]));
    const opciones = [['Todos', coinciden.length], ...categorias.map((categoria) => [categoria, conteos.get(categoria)])];
    const botones = opciones.map(([categoria, cantidad]) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = `${BOTON_BASE} ${categoria === categoriaActiva ? BOTON_ACTIVO : BOTON_INACTIVO}`;
      boton.textContent = `${categoria} (${cantidad})`;
      boton.setAttribute('aria-pressed', String(categoria === categoriaActiva));
      boton.addEventListener('click', () => {
        categoriaActiva = categoria;
        renderizar();
      });
      return boton;
    });
    filtros.replaceChildren(...botones);

    const visibles = coinciden
      .filter((producto) => categoriaActiva === 'Todos' || (producto.categoria || 'Otros') === categoriaActiva)
      .sort((a, b) => ordenar(a.categoria || 'Otros', b.categoria || 'Otros') || ordenar(a.nombre || '', b.nombre || ''));
    if (visibles.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'text-tinta-suave';
      vacio.textContent = 'No se encontraron productos con esos criterios.';
      lista.replaceChildren(vacio);
      return;
    }

    const grupos = new Map();
    for (const producto of visibles) {
      const categoria = producto.categoria || 'Otros';
      if (!grupos.has(categoria)) grupos.set(categoria, []);
      grupos.get(categoria).push(producto);
    }
    lista.replaceChildren(...[...grupos].map(([categoria, articulos]) => crearSeccion(categoria, articulos)));
  }

  lista.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const boton = event.target.closest('button[data-product-id]');
    if (boton) carrito.agregar(boton.dataset.productId);
  });
  busqueda.addEventListener('input', renderizar);
  renderizar();
}
