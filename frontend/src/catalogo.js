const formatoPrecio = (n) => '$' + Number(n).toLocaleString('es-CO');

const BOTON_BASE = 'px-4 py-2 rounded-full text-sm font-medium border transition focus-visible:ring-2 focus-visible:ring-acento focus-visible:outline-none cursor-pointer';
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

let modalActualProducto = null;

function configurarModalDetalle(agregarAlCarrito) {
  const backdrop = document.getElementById('product-modal-backdrop');
  const card = document.getElementById('product-modal-card');
  const img = document.getElementById('modal-product-image');
  const cat = document.getElementById('modal-product-category');
  const title = document.getElementById('modal-product-title');
  const price = document.getElementById('modal-product-price');
  const desc = document.getElementById('modal-product-description');
  const btnAdd = document.getElementById('modal-add-to-cart');
  const btnClose = document.getElementById('modal-close-button');
  const btnCloseBottom = document.getElementById('modal-close-bottom');

  if (!backdrop || !card) return () => {};

  function cerrarModal() {
    backdrop.classList.add('hidden');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function abrirModal(producto) {
    modalActualProducto = producto;
    img.src = producto.imagen || '/icon-192.png';
    img.alt = producto.nombre || 'Producto';
    cat.textContent = producto.categoria || 'Otros';
    title.textContent = producto.nombre || 'Producto sin nombre';
    if (producto.unidad) {
      title.textContent += ' ' + producto.unidad;
    }
    price.textContent = formatoPrecio(producto.precio);

    const descripcionGenerada = producto.descripcion ||
      `${producto.nombre} es un producto fresco y seleccionado de la categoría ${producto.categoria || 'general'}${producto.unidad ? `, disponible en presentación ${producto.unidad}` : ''}. Puedes adquirirlo directamente en nuestra tienda en Cali o pedirlo a domicilio por este catálogo web.`;
    desc.textContent = descripcionGenerada;

    backdrop.classList.remove('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    btnClose.focus();
  }

  btnClose?.addEventListener('click', cerrarModal);
  btnCloseBottom?.addEventListener('click', cerrarModal);
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) cerrarModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) cerrarModal();
  });

  btnAdd?.addEventListener('click', () => {
    if (!modalActualProducto) return;
    agregarAlCarrito(claveProducto(modalActualProducto));
    btnAdd.textContent = '✓ ¡Agregado!';
    setTimeout(() => {
      btnAdd.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM9 8a3 3 0 0 1 6 0" />
        </svg>
        <span>Agregar al carrito</span>
      `;
      cerrarModal();
    }, 600);
  });

  return abrirModal;
}

function crearTarjeta(producto, onVerDetalle) {
  const tarjeta = document.createElement('article');
  tarjeta.className =
    'bg-superficie rounded-3xl p-3 sm:p-4 shadow-xs hover:shadow-md transition duration-300 flex flex-col group border border-borde/70';

  const marco = document.createElement('button');
  marco.type = 'button';
  marco.className = 'aspect-4/5 rounded-2xl overflow-hidden bg-hielo mb-3 sm:mb-4 cursor-pointer text-left block w-full focus-visible:ring-2 focus-visible:ring-acento';
  marco.setAttribute('aria-label', `Ver detalles de ${producto.nombre}`);
  marco.addEventListener('click', () => onVerDetalle(producto));

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
  info.className = 'px-1 sm:px-2 pb-1 sm:pb-2 flex-1 flex flex-col justify-between';

  const nombreBtn = document.createElement('button');
  nombreBtn.type = 'button';
  nombreBtn.className = 'text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-acento rounded-sm';
  nombreBtn.setAttribute('aria-label', `Ver detalles de ${producto.nombre}`);
  nombreBtn.addEventListener('click', () => onVerDetalle(producto));

  const nombre = document.createElement('h4');
  nombre.className = 'font-serif-custom text-base sm:text-lg font-semibold leading-snug text-tinta hover:text-acento transition';
  nombre.textContent = producto.nombre || 'Producto sin nombre';

  if (producto.unidad) {
    const unidad = document.createElement('span');
    unidad.className = 'text-sm font-normal text-tinta-suave';
    unidad.textContent = ' ' + producto.unidad;
    nombre.appendChild(unidad);
  }
  nombreBtn.appendChild(nombre);

  const precio = document.createElement('p');
  precio.className = 'text-acento font-bold mt-1.5 text-base sm:text-lg';
  precio.textContent = formatoPrecio(producto.precio);

  const agregar = document.createElement('button');
  agregar.type = 'button';
  agregar.dataset.productId = claveProducto(producto);
  agregar.className =
    'mt-4 w-full rounded-full border border-acento px-4 py-2 text-sm font-medium text-acento transition hover:bg-acento hover:text-white focus-visible:ring-2 focus-visible:ring-acento cursor-pointer';
  agregar.textContent = 'Agregar al carrito';

  info.append(nombreBtn, precio);
  tarjeta.append(marco, info, agregar);
  return tarjeta;
}

function crearSeccion(categoria, productos, onVerDetalle) {
  const seccion = document.createElement('section');

  const titulo = document.createElement('h3');
  titulo.className = 'font-serif-custom text-2xl font-semibold mb-6';
  titulo.textContent = categoria;

  const grilla = document.createElement('div');
  grilla.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6';
  grilla.append(...productos.map((p) => crearTarjeta(p, onVerDetalle)));

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
  const summaryCount = document.getElementById('cart-summary-items-count');
  const summaryDelivery = document.getElementById('cart-summary-delivery');
  const enlaceUbicacion = document.getElementById('cart-location');

  const radiosDelivery = document.querySelectorAll('input[name="cart-delivery-type"]');
  const addressWrapper = document.getElementById('cart-address-wrapper');
  const inputAddress = document.getElementById('cart-client-address');
  const inputClienteNombre = document.getElementById('cart-client-name');
  const inputClienteTelefono = document.getElementById('cart-client-phone');
  const botonHacerPedido = document.getElementById('cart-submit-order');
  const botonWhatsApp = document.getElementById('cart-whatsapp-button');
  const statusPedido = document.getElementById('cart-order-status');

  const porId = new Map(productos.map((producto) => [claveProducto(producto), producto]));
  const carrito = new Map();
  let focoAnterior = null;
  let overflowAnterior = '';
  let ultimoPedidoCreado = null;

  function obtenerTipoEntrega() {
    const seleccionado = document.querySelector('input[name="cart-delivery-type"]:checked');
    return seleccionado ? seleccionado.value : 'recogida';
  }

  function actualizarVisibilidadEntrega() {
    const tipo = obtenerTipoEntrega();
    if (tipo === 'domicilio') {
      addressWrapper?.classList.remove('hidden');
      if (summaryDelivery) summaryDelivery.textContent = 'Domicilio en Cali';
    } else {
      addressWrapper?.classList.add('hidden');
      if (summaryDelivery) summaryDelivery.textContent = 'Recogida en tienda (Gratis)';
    }
  }

  radiosDelivery.forEach((radio) => {
    radio.addEventListener('change', actualizarVisibilidadEntrega);
  });
  actualizarVisibilidadEntrega();

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
    const cantidadTotal = [...carrito.values()].reduce((acc, item) => acc + item.cantidad, 0);
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
      subtotal.textContent = '$0';
      if (summaryCount) summaryCount.textContent = '$0';
      if (botonHacerPedido) botonHacerPedido.disabled = true;
      return;
    }

    if (botonHacerPedido) botonHacerPedido.disabled = false;

    const articulos = [];
    let sumaTotal = 0;

    for (const [id, item] of carrito) {
      const itemSubtotal = (item.producto.precio || 0) * item.cantidad;
      sumaTotal += itemSubtotal;

      const fila = document.createElement('article');
      fila.className = 'grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-borde py-4';

      const img = document.createElement('img');
      img.src = item.producto.imagen || '/icon-192.png';
      img.alt = '';
      img.className = 'h-14 w-14 rounded-xl bg-hielo object-cover';
      img.onerror = () => {
        img.onerror = null;
        img.src = '/icon-192.png';
      };

      const info = document.createElement('div');
      info.className = 'min-w-0';

      const titulo = document.createElement('h3');
      titulo.className = 'break-words text-sm font-semibold text-tinta';
      titulo.textContent = item.producto.nombre || 'Producto sin nombre';

      const precioUnidad = document.createElement('p');
      precioUnidad.className = 'mt-0.5 text-xs text-tinta-suave';
      precioUnidad.textContent = `${formatoPrecio(item.producto.precio)} c/u`;

      const subtotalTexto = document.createElement('p');
      subtotalTexto.className = 'text-xs font-semibold text-acento';
      subtotalTexto.textContent = `Subtotal: ${formatoPrecio(itemSubtotal)}`;

      const controles = document.createElement('div');
      controles.className = 'mt-2 inline-flex items-center gap-3 rounded-full border border-control px-2 py-1';

      const btnRestar = document.createElement('button');
      btnRestar.type = 'button';
      btnRestar.dataset.action = 'restar';
      btnRestar.dataset.productId = id;
      btnRestar.setAttribute('aria-label', `Restar una unidad de ${item.producto.nombre}`);
      btnRestar.className = 'text-sm font-semibold text-tinta hover:text-acento cursor-pointer';
      btnRestar.textContent = '−';

      const cant = document.createElement('span');
      cant.className = 'min-w-4 text-center text-xs font-semibold';
      cant.textContent = String(item.cantidad);

      const btnSumar = document.createElement('button');
      btnSumar.type = 'button';
      btnSumar.dataset.action = 'sumar';
      btnSumar.dataset.productId = id;
      btnSumar.setAttribute('aria-label', `Sumar una unidad de ${item.producto.nombre}`);
      btnSumar.className = 'text-sm font-semibold text-tinta hover:text-acento cursor-pointer';
      btnSumar.textContent = '+';

      controles.append(btnRestar, cant, btnSumar);
      info.append(titulo, precioUnidad, subtotalTexto, controles);

      const btnQuitar = document.createElement('button');
      btnQuitar.type = 'button';
      btnQuitar.dataset.action = 'quitar';
      btnQuitar.dataset.productId = id;
      btnQuitar.setAttribute('aria-label', `Quitar ${item.producto.nombre} del carrito`);
      btnQuitar.className = 'text-xs text-tinta-suave hover:text-error cursor-pointer p-1';
      btnQuitar.textContent = 'Quitar';

      fila.append(img, info, btnQuitar);
      articulos.push(fila);
    }

    items.replaceChildren(...articulos);
    subtotal.textContent = formatoPrecio(sumaTotal);
    if (summaryCount) summaryCount.textContent = formatoPrecio(sumaTotal);
  }

  abrir.addEventListener('click', () => abrirCarrito());
  cerrar.addEventListener('click', () => cerrarCarrito());
  overlay.addEventListener('click', () => cerrarCarrito());
  enlaceUbicacion?.addEventListener('click', () => cerrarCarrito(false));
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

  async function enviarPedido() {
    if (carrito.size === 0) {
      if (statusPedido) {
        statusPedido.textContent = 'El carrito está vacío. Agrega productos antes de confirmar.';
        statusPedido.className = 'text-xs text-center font-medium min-h-4 text-error';
      }
      return;
    }

    const nombre = (inputClienteNombre?.value || '').trim();
    if (!nombre || nombre.length < 2) {
      if (statusPedido) {
        statusPedido.textContent = 'Por favor ingresa tu nombre para el pedido.';
        statusPedido.className = 'text-xs text-center font-medium min-h-4 text-error';
      }
      inputClienteNombre?.focus();
      return;
    }

    const telefono = (inputClienteTelefono?.value || '').trim();
    if (!telefono || telefono.length < 7) {
      if (statusPedido) {
        statusPedido.textContent = 'Por favor ingresa un teléfono o WhatsApp de contacto válido.';
        statusPedido.className = 'text-xs text-center font-medium min-h-4 text-error';
      }
      inputClienteTelefono?.focus();
      return;
    }

    const tipoEntrega = obtenerTipoEntrega();
    const direccion = (inputAddress?.value || '').trim();
    if (tipoEntrega === 'domicilio' && (!direccion || direccion.length < 5)) {
      if (statusPedido) {
        statusPedido.textContent = 'Por favor ingresa la dirección completa de entrega en Cali.';
        statusPedido.className = 'text-xs text-center font-medium min-h-4 text-error';
      }
      inputAddress?.focus();
      return;
    }

    const productosPedido = [...carrito.values()].map((i) => ({
      nombre: i.producto.nombre || 'Producto',
      cantidad: i.cantidad,
      precio: i.producto.precio || 0,
    }));
    const total = productosPedido.reduce((acc, p) => acc + p.precio * p.cantidad, 0);

    if (botonHacerPedido) {
      botonHacerPedido.disabled = true;
      botonHacerPedido.textContent = 'Registrando pedido…';
    }
    if (statusPedido) {
      statusPedido.textContent = '';
    }

    try {
      let pedidoId = null;

      try {
        const { collection, addDoc } = await import('firebase/firestore');
        const { db } = await import('./firebase/client.js');
        if (db) {
          const docRef = await addDoc(collection(db, 'pedidos'), {
            clienteNombre: nombre,
            clienteTelefono: telefono,
            tipoEntrega,
            direccion: tipoEntrega === 'domicilio' ? direccion : '',
            productos: productosPedido,
            total,
            estado: 'pendiente',
            creadoEn: new Date().toISOString(),
          });
          pedidoId = docRef.id;
        }
      } catch (firestoreError) {
        console.warn('Error guardando en Firestore, intentando endpoint backend:', firestoreError);
      }

      if (!pedidoId) {
        const res = await fetch('/api/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clienteNombre: nombre,
            clienteTelefono: telefono,
            tipoEntrega,
            direccion: tipoEntrega === 'domicilio' ? direccion : '',
            productos: productosPedido,
            total,
          }),
        });
        if (!res.ok) throw new Error('No se pudo registrar el pedido en el servidor.');
        const data = await res.json().catch(() => null);
        if (!data || !data.id) throw new Error('No se pudo confirmar el pedido en el servidor.');
        pedidoId = data.id;
      }

      const idCorto = pedidoId.slice(0, 8).toUpperCase();
      ultimoPedidoCreado = {
        id: idCorto,
        clienteNombre: nombre,
        clienteTelefono: telefono,
        tipoEntrega,
        direccion,
        productos: productosPedido,
        total,
      };

      carrito.clear();
      renderizarCarrito();

      if (statusPedido) {
        statusPedido.textContent = `¡Pedido #${idCorto} registrado con éxito! El administrador ya lo puede ver en su panel.`;
        statusPedido.className = 'text-xs text-center font-medium min-h-4 text-exito';
      }

      if (botonWhatsApp) {
        botonWhatsApp.classList.remove('hidden');
      }

      if (botonHacerPedido) {
        botonHacerPedido.textContent = '✓ Pedido Registrado';
      }
    } catch (err) {
      console.error('Error enviando pedido:', err);
      if (statusPedido) {
        statusPedido.textContent = err.message || 'Error al enviar el pedido. Intenta nuevamente.';
        statusPedido.className = 'text-xs text-center font-medium min-h-4 text-error';
      }
      if (botonHacerPedido) {
        botonHacerPedido.disabled = false;
        botonHacerPedido.textContent = 'Confirmar y realizar pedido';
      }
    }
  }

  function enviarPorWhatsApp() {
    let numeroComercial = String(import.meta.env.VITE_WHATSAPP_NUMBER || '573016445177').replace(/\D/g, '');
    if (numeroComercial.length === 10 && numeroComercial.startsWith('3')) {
      numeroComercial = '57' + numeroComercial;
    }
    if (!numeroComercial) {
      numeroComercial = '573016445177';
    }

    let pedido = ultimoPedidoCreado;

    if (!pedido) {
      if (carrito.size === 0) {
        if (statusPedido) {
          statusPedido.textContent = 'Tu carrito está vacío. Agrega productos para ordenar por WhatsApp.';
          statusPedido.className = 'text-xs text-center font-medium min-h-4 text-error';
        }
        return;
      }

      const nombre = (inputClienteNombre?.value || '').trim();
      if (!nombre || nombre.length < 2) {
        if (statusPedido) {
          statusPedido.textContent = 'Por favor ingresa tu nombre para enviar el pedido por WhatsApp.';
          statusPedido.className = 'text-xs text-center font-medium min-h-4 text-error';
        }
        inputClienteNombre?.focus();
        return;
      }

      const telefono = (inputClienteTelefono?.value || '').trim();
      if (!telefono || telefono.length < 7) {
        if (statusPedido) {
          statusPedido.textContent = 'Por favor ingresa un teléfono o WhatsApp de contacto válido.';
          statusPedido.className = 'text-xs text-center font-medium min-h-4 text-error';
        }
        inputClienteTelefono?.focus();
        return;
      }

      const tipoEntrega = obtenerTipoEntrega();
      const direccion = (inputAddress?.value || '').trim();
      if (tipoEntrega === 'domicilio' && (!direccion || direccion.length < 5)) {
        if (statusPedido) {
          statusPedido.textContent = 'Por favor ingresa la dirección completa de entrega en Cali.';
          statusPedido.className = 'text-xs text-center font-medium min-h-4 text-error';
        }
        inputAddress?.focus();
        return;
      }

      const productosPedido = [...carrito.values()].map((i) => ({
        nombre: i.producto.nombre || 'Producto',
        cantidad: i.cantidad,
        precio: i.producto.precio || 0,
      }));
      const total = productosPedido.reduce((acc, p) => acc + p.precio * p.cantidad, 0);

      pedido = {
        id: null,
        clienteNombre: nombre,
        clienteTelefono: telefono,
        tipoEntrega,
        direccion,
        productos: productosPedido,
        total,
      };

      enviarPedido().catch(() => {});
    }

    const { id, clienteNombre, clienteTelefono, tipoEntrega, direccion, productos, total } = pedido;

    const lineasProductos = productos
      .map((p) => `• ${p.nombre} × ${p.cantidad} = ${formatoPrecio(p.precio * p.cantidad)} (${formatoPrecio(p.precio)} c/u)`)
      .join('\n');

    const entregaTexto = tipoEntrega === 'domicilio'
      ? `🛵 Domicilio en Cali\n📍 Dirección: ${direccion || 'Por confirmar en el chat'}`
      : '🏬 Recogida en tienda (El Edén, Bella Suiza, Cali)';

    const encabezado = id
      ? `Acabo de registrar el siguiente pedido en la tienda web:\n\n📦 Pedido: #${id}\n`
      : `Quiero realizar el siguiente pedido por el catálogo web:\n\n`;

    const mensaje = `¡Hola, Adargeyi! 👋\n` +
      encabezado +
      `👤 Cliente: ${clienteNombre}\n` +
      `📞 Contacto: ${clienteTelefono}\n` +
      `🛵 Entrega: ${entregaTexto}\n\n` +
      `🛒 Productos seleccionados:\n${lineasProductos}\n\n` +
      `💰 Total: ${formatoPrecio(total)}\n\n` +
      `Quedo atento(a) para coordinar la entrega. ¡Muchas gracias!`;

    const url = `https://wa.me/${numeroComercial}?text=${encodeURIComponent(mensaje)}`;
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.href = url;
    }
  }

  botonHacerPedido?.addEventListener('click', enviarPedido);
  botonWhatsApp?.addEventListener('click', enviarPorWhatsApp);

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
  const abrirModal = configurarModalDetalle((id) => carrito.agregar(id));
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

    const filtrados = coinciden
      .filter((producto) => categoriaActiva === 'Todos' || (producto.categoria || 'Otros') === categoriaActiva)
      .sort((a, b) => ordenar(a.categoria || 'Otros', b.categoria || 'Otros') || ordenar(a.nombre || '', b.nombre || ''));

    if (filtrados.length === 0) {
      const aviso = document.createElement('p');
      aviso.className = 'text-tinta-suave';
      aviso.textContent = 'No se encontraron productos con esos criterios de búsqueda.';
      lista.replaceChildren(aviso);
      return;
    }

    const agrupados = new Map();
    for (const producto of filtrados) {
      const categoria = producto.categoria || 'Otros';
      if (!agrupados.has(categoria)) agrupados.set(categoria, []);
      agrupados.get(categoria).push(producto);
    }

    const secciones = [...agrupados.entries()].map(([categoria, listaProductos]) =>
      crearSeccion(categoria, listaProductos, abrirModal),
    );
    lista.replaceChildren(...secciones);
  }

  lista.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const boton = event.target.closest('button[data-product-id]');
    if (boton) {
      carrito.agregar(boton.dataset.productId);
    }
  });

  busqueda.addEventListener('input', renderizar);
  renderizar();

  if (typeof window !== 'undefined') {
    window.webmcp = {
      name: 'Adargeyi Store Assistant',
      buscarProductos: ({ termino, categoria }) => {
        const t = normalizar(termino || '');
        return productos
          .filter((p) => {
            const coincideTermino = normalizar(p.nombre).includes(t);
            const coincideCat = !categoria || normalizar(p.categoria) === normalizar(categoria);
            return coincideTermino && coincideCat;
          })
          .map((p) => ({ nombre: p.nombre, precio: p.precio, categoria: p.categoria, unidad: p.unidad }));
      },
      obtenerInfoTienda: () => ({
        nombre: 'Adargeyi',
        direccion: 'Manzana A Casa 8 Parte Alta El Edén Sector, Bella Suiza, Cali, Valle del Cauca',
        horario: 'Todos los días de 7:00 AM a 10:00 PM',
        telefono: '+573016445177',
        modalidades: ['Venta en tienda física', 'Domicilios en Cali'],
      }),
      consultarOpcionesEntrega: () => ({
        modalidades: ['Recogida en tienda (Gratis)', 'Entrega a domicilio en Cali'],
        cobertura: 'Comuna 18 y sectores aledaños en Cali (Bella Suiza, El Edén y alrededores)',
      }),
    };
  }
}
