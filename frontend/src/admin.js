import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase/client.js';
import { ADMIN_EMAIL, esAdministrador, olvidarPropietario, recordarPropietario } from './auth/propietario.js';

const $ = (id) => document.getElementById(id);
const loginPanel = $('login-panel');
const adminPanel = $('admin-panel');
const loginForm = $('login-form');
const productForm = $('product-form');
const list = $('admin-product-list');
const imageInput = $('product-image');
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const maxFileBytes = 5 * 1024 * 1024;
const maxEncodedImageBytes = 420 * 1024; // Mantiene el documento por debajo del límite de Firestore.
let currentUser = null;
let products = [];
let currentImageUrl = '';
let pendingPreviewUrl = '';
let bulkQueue = [];
let nextBulkItemId = 0;
let bulkGuardando = false;

function message(id, text, isError = false) {
  const el = $(id);
  // El símbolo (✓ / ⚠) evita que el estado dependa solo del color (WCAG 1.4.1).
  el.textContent = text ? `${isError ? '⚠' : '✓'} ${text}` : '';
  el.className = `text-sm font-medium ${isError ? 'text-error' : 'text-exito'}`;
}

function safeError(error) {
  const code = error?.code || '';
  const messages = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/invalid-login-credentials': 'Correo o contraseña incorrectos.',
    'auth/invalid-email': 'El correo electrónico no tiene un formato válido.',
    'auth/user-disabled': 'Esta cuenta está desactivada. Contacta al administrador del proyecto.',
    'auth/too-many-requests': 'Se bloquearon temporalmente los intentos. Espera e inténtalo de nuevo.',
    'auth/network-request-failed': 'No hay conexión. Comprueba tu internet e inténtalo otra vez.',
    'auth/operation-not-allowed': 'El inicio de sesión por correo no está habilitado. Contacta al administrador del proyecto.',
    'permission-denied': 'No tienes permiso para realizar esta acción. Comprueba que tu cuenta sea la administradora.',
    'unauthenticated': 'Tu sesión venció. Inicia sesión de nuevo e inténtalo otra vez.',
    'unavailable': 'Firebase no está disponible temporalmente. Comprueba tu conexión e inténtalo de nuevo.',
    'deadline-exceeded': 'La operación tardó demasiado. Comprueba tu conexión e inténtalo de nuevo.',
    'resource-exhausted': 'Se alcanzó temporalmente un límite del servicio. Espera un momento e inténtalo de nuevo.',
    'invalid-argument': 'Algunos datos no son válidos. Revísalos e inténtalo de nuevo.',
    'failed-precondition': 'No se pudo completar la operación por la configuración actual. Contacta al administrador.',
    'not-found': 'El producto ya no existe. Actualiza la lista e inténtalo de nuevo.',
    'already-exists': 'Ya existe un elemento con esos datos. Actualiza la lista e inténtalo de nuevo.',
  };
  if (messages[code]) return messages[code];
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'No hay conexión a internet. Revisa tu conexión e inténtalo de nuevo.';
  }
  return 'No se pudo completar la operación. Comprueba tu conexión e inténtalo de nuevo.';
}
function mostrarErrorCargaProductos(error) {
  list.replaceChildren();
  const aviso = document.createElement('p');
  aviso.className = 'text-sm font-medium text-error';
  aviso.setAttribute('role', 'alert');
  aviso.textContent = safeError(error);

  const reintentar = document.createElement('button');
  reintentar.type = 'button';
  reintentar.className = 'mt-3 rounded-full border border-control px-4 py-2 text-sm font-medium hover:border-acento hover:text-acento focus-visible:ring-2 focus-visible:ring-acento';
  reintentar.textContent = 'Intentar de nuevo';
  reintentar.addEventListener('click', async () => {
    reintentar.disabled = true;
    reintentar.textContent = 'Cargando…';
    try {
      await loadProducts();
      message('global-message', 'Catálogo actualizado.');
    } catch (loadError) {
      console.error('No se pudieron cargar los productos:', loadError);
      mostrarErrorCargaProductos(loadError);
    }
  });
  list.append(aviso, reintentar);
}
function validateImage(file) {
  if (!file) return;
  if (!allowedTypes.has(file.type)) throw new Error('Usa imágenes JPG, PNG, WebP o AVIF.');
  if (file.size > maxFileBytes) throw new Error(`La imagen «${file.name}» supera el límite de 5 MB.`);
}
function productImage(product) {
  return product.imagen || '';
}
function money(value) {
  return '$' + Number(value || 0).toLocaleString('es-CO');
}
function nombreInicial(file) {
  return file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function renderBulkQueue() {
  const preview = $('bulk-preview');
  $('bulk-count').textContent = bulkQueue.length
    ? `${bulkQueue.length} imagen(es) preparadas. Completa los datos de cada producto antes de guardar.`
    : 'No hay imágenes preparadas.';
  $('bulk-button').disabled = bulkGuardando || bulkQueue.length === 0;
  $('bulk-images').disabled = bulkGuardando;
  $('bulk-folder').disabled = bulkGuardando;
  preview.replaceChildren();

  for (const item of bulkQueue) {
    const card = document.createElement('article');
    card.className = 'grid grid-cols-1 sm:grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-2xl border border-borde p-3';

    const image = document.createElement('img');
    image.src = item.previewUrl;
    image.alt = `Vista previa: ${item.file.name}`;
    image.className = 'h-24 w-24 rounded-xl bg-hielo object-contain';

    const fields = document.createElement('div');
    fields.className = 'grid gap-3 sm:grid-cols-2';

    const nameLabel = document.createElement('label');
    nameLabel.className = 'text-sm font-semibold text-tinta sm:col-span-2';
    nameLabel.textContent = 'Nombre del producto';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 120;
    nameInput.required = true;
    nameInput.disabled = bulkGuardando;
    nameInput.value = item.name;
    nameInput.className = 'mt-1 w-full rounded-xl border border-control px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-acento';
    nameInput.addEventListener('input', () => {
      item.name = nameInput.value;
      item.error = '';
      card.querySelector('[role="alert"]')?.remove();
    });
    nameLabel.append(nameInput);

    const priceLabel = document.createElement('label');
    priceLabel.className = 'text-sm font-semibold text-tinta';
    priceLabel.textContent = 'Precio (COP)';
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.min = '0';
    priceInput.step = '50';
    priceInput.required = true;
    priceInput.disabled = bulkGuardando;
    priceInput.value = item.price;
    priceInput.placeholder = 'Ej. 2500';
    priceInput.className = 'mt-1 w-full rounded-xl border border-control px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-acento';
    priceInput.addEventListener('input', () => {
      item.price = priceInput.value;
      item.error = '';
      card.querySelector('[role="alert"]')?.remove();
    });
    priceLabel.append(priceInput);

    const categoryLabel = document.createElement('label');
    categoryLabel.className = 'text-sm font-semibold text-tinta';
    categoryLabel.textContent = 'Categoría';
    const categoryInput = document.createElement('input');
    categoryInput.type = 'text';
    categoryInput.maxLength = 80;
    categoryInput.required = true;
    categoryInput.disabled = bulkGuardando;
    categoryInput.value = item.category;
    categoryInput.placeholder = 'Ej. Bebidas';
    categoryInput.setAttribute('list', 'category-options');
    categoryInput.className = 'mt-1 w-full rounded-xl border border-control px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-acento';
    categoryInput.addEventListener('input', () => {
      item.category = categoryInput.value;
      item.error = '';
      card.querySelector('[role="alert"]')?.remove();
    });
    categoryLabel.append(categoryInput);

    const controls = document.createElement('div');
    controls.className = 'flex items-center justify-between gap-2 sm:col-span-2';
    const fileName = document.createElement('p');
    fileName.className = 'min-w-0 break-all text-xs text-tinta-suave';
    fileName.textContent = item.file.webkitRelativePath || item.file.name;
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.disabled = bulkGuardando;
    removeButton.className = 'shrink-0 rounded-full border border-control px-3 py-1.5 text-sm font-medium hover:border-error hover:text-error';
    removeButton.textContent = 'Quitar';
    removeButton.setAttribute('aria-label', `Quitar ${item.file.name}`);
    removeButton.addEventListener('click', () => {
      URL.revokeObjectURL(item.previewUrl);
      bulkQueue = bulkQueue.filter((queued) => queued.id !== item.id);
      renderBulkQueue();
      message('bulk-message', '');
    });
    controls.append(fileName, removeButton);

    fields.append(nameLabel, priceLabel, categoryLabel, controls);
    if (item.error) {
      const error = document.createElement('p');
      error.className = 'text-sm font-medium text-error sm:col-span-2';
      error.setAttribute('role', 'alert');
      error.textContent = item.error;
      fields.append(error);
    }
    card.append(image, fields);
    preview.append(card);
  }
}
function renderProducts() {
  const search = $('product-search').value.trim().toLocaleLowerCase('es');
  const filtered = products.filter((p) => `${p.nombre || ''} ${p.categoria || ''}`.toLocaleLowerCase('es').includes(search));
  $('product-count').textContent = `${filtered.length} de ${products.length} productos`;
  if (!products.length) {
    list.innerHTML = '<p class="text-sm text-tinta-suave py-6">Aún no hay productos en el catálogo.</p>';
    return;
  }
  if (!filtered.length) {
    list.innerHTML = '<p class="text-sm text-tinta-suave py-6">No se encontraron productos.</p>';
    return;
  }
  list.replaceChildren();
  for (const product of filtered) {
    const row = document.createElement('article');
    row.className = 'flex gap-3 items-center border border-borde rounded-2xl p-3';
    const img = document.createElement('img');
    img.className = 'w-16 h-16 rounded-xl object-contain bg-hielo shrink-0';
    img.alt = '';
    img.loading = 'lazy';
    img.src = productImage(product) || '/icon-192.png';
    img.onerror = () => { img.onerror = null; img.src = '/icon-192.png'; };
    const info = document.createElement('div');
    info.className = 'min-w-0 flex-1';
    const name = document.createElement('p');
    name.className = 'font-semibold break-words';
    name.textContent = product.nombre || 'Producto sin nombre';
    const meta = document.createElement('p');
    meta.className = 'text-sm text-tinta-suave';
    meta.textContent = `${money(product.precio)} · ${product.categoria || 'Otros'}`;
    info.append(name, meta);
    const actions = document.createElement('div');
    actions.className = 'flex flex-col gap-2 shrink-0';
    const edit = document.createElement('button');
    edit.type = 'button'; edit.textContent = 'Editar';
    edit.className = 'rounded-full border border-acento px-3 py-1.5 text-sm text-acento hover:bg-acento hover:text-white';
    edit.addEventListener('click', () => startEdit(product));
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = 'Eliminar';
    remove.className = 'rounded-full border border-error px-3 py-1.5 text-sm text-error hover:bg-red-50';
    remove.addEventListener('click', () => removeProduct(product, remove));
    actions.append(edit, remove);
    row.append(img, info, actions);
    list.append(row);
  }
}
async function loadProducts() {
  list.innerHTML = '<p class="text-sm text-tinta-suave py-6">Cargando productos…</p>';
  const snapshot = await getDocs(collection(db, 'productos'));
  products = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
  products.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  renderProducts();
}
async function uploadImage(file) {
  validateImage(file);
  // Sin Firebase Storage: comprime la imagen en el navegador y la guarda como
  // data URL en el documento de Firestore. Firestore limita cada documento a 1 MiB.
  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 1200;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let quality = 0.78;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (new Blob([dataUrl]).size > maxEncodedImageBytes && quality > 0.35) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    if (new Blob([dataUrl]).size > maxEncodedImageBytes) {
      throw new Error('La imagen sigue siendo demasiado pesada después de comprimirla. Usa una imagen más pequeña.');
    }
    return dataUrl;
  } finally {
    bitmap.close?.();
  }
}
function startEdit(product) {
  productForm.reset();
  $('product-id').value = product.id;
  $('product-name').value = product.nombre || '';
  $('product-price').value = Number(product.precio || 0);
  $('product-category').value = product.categoria || 'Otros';
  currentImageUrl = productImage(product);
  $('form-title').textContent = 'Editar producto';
  $('form-help').textContent = 'Modifica los datos y, si lo necesitas, selecciona una nueva imagen.';
  $('save-product-button').textContent = 'Guardar cambios';
  $('cancel-edit-button').classList.remove('hidden');
  $('image-help').textContent = currentImageUrl ? 'Si no seleccionas otra imagen, se conservará la actual.' : 'Selecciona una imagen para este producto.';
  $('image-preview-wrap').classList.toggle('hidden', !currentImageUrl);
  $('image-preview').src = currentImageUrl;
  $('current-image-label').textContent = currentImageUrl ? 'Imagen actual' : '';
  message('product-message', '');
  $('form-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function resetProductForm() {
  productForm.reset();
  $('product-id').value = '';
  currentImageUrl = '';
  $('form-title').textContent = 'Añadir productos';
  $('form-help').textContent = 'Completa los datos y selecciona una imagen para crear un producto.';
  $('save-product-button').textContent = 'Guardar producto';
  $('cancel-edit-button').classList.add('hidden');
  $('image-preview-wrap').classList.add('hidden');
  $('image-preview').removeAttribute('src');
  $('current-image-label').textContent = '';
  message('product-message', '');
}
async function removeProduct(product, button) {
  const confirmed = window.confirm(`¿Seguro que deseas eliminar «${product.nombre}»? Esta acción no se puede deshacer.`);
  if (!confirmed) return;
  button.disabled = true;
  try {
    await deleteDoc(doc(db, 'productos', product.id));
    products = products.filter((item) => item.id !== product.id);
    renderProducts();
    message('global-message', `Se eliminó «${product.nombre}».`);
  } catch (error) {
    console.error(error); message('global-message', safeError(error), true); button.disabled = false;
  }
}

$('toggle-password').addEventListener('click', () => {
  const field = $('password');
  const show = field.type === 'password';
  field.type = show ? 'text' : 'password';
  $('toggle-password').textContent = show ? 'Ocultar' : 'Mostrar';
});
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('login-button'); button.disabled = true; button.textContent = 'Verificando…';
  message('login-message', '');
  try {
    if (!ADMIN_EMAIL) throw new Error('Falta configurar VITE_ADMIN_EMAIL en el archivo .env.');
    const credential = await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value);
    if (!esAdministrador(credential.user)) {
      await signOut(auth);
      throw new Error('Esta cuenta no está autorizada para administrar la tienda.');
    }
  } catch (error) {
    console.error('Inicio de sesión rechazado:', error);
    message('login-message', error.message?.startsWith('Falta configurar') || error.message?.startsWith('Esta cuenta') ? error.message : safeError(error), true);
  } finally { button.disabled = false; button.textContent = 'Iniciar sesión'; }
});
$('logout-button').addEventListener('click', async () => {
  olvidarPropietario();
  try { await signOut(auth); }
  catch (error) { message('global-message', safeError(error), true); }
});
$('product-search').addEventListener('input', renderProducts);
$('cancel-edit-button').addEventListener('click', resetProductForm);
imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
  if (!file) { $('image-preview-wrap').classList.toggle('hidden', !currentImageUrl); $('image-preview').src = currentImageUrl; return; }
  try {
    validateImage(file);
    pendingPreviewUrl = URL.createObjectURL(file);
    $('image-preview').src = pendingPreviewUrl;
    $('image-preview-wrap').classList.remove('hidden');
    $('current-image-label').textContent = 'Nueva imagen seleccionada';
    message('product-message', '');
  } catch (error) { imageInput.value = ''; message('product-message', error.message, true); }
});
productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser || !esAdministrador(currentUser)) return message('product-message', 'Tu sesión no tiene permisos de administrador.', true);
  const button = $('save-product-button'); button.disabled = true; button.textContent = 'Guardando…';
  try {
    const id = $('product-id').value;
    const name = $('product-name').value.trim();
    const price = Number($('product-price').value);
    const category = $('product-category').value.trim();
    const file = imageInput.files?.[0];
    if (!name || !category || !Number.isFinite(price) || price < 0) throw new Error('Revisa el nombre, la categoría y el precio.');
    validateImage(file);
    if (!id && !file) throw new Error('Selecciona una imagen para el producto.');
    const data = { nombre: name, precio: price, categoria: category };
    if (id) {
      if (file) data.imagen = await uploadImage(file);
      else data.imagen = currentImageUrl;
      await updateDoc(doc(db, 'productos', id), data);
      message('product-message', 'Producto actualizado correctamente.');
    } else {
      const newRef = doc(collection(db, 'productos'));
      data.imagen = await uploadImage(file);
      await setDoc(newRef, data);
      message('product-message', 'Producto añadido correctamente.');
    }
    await loadProducts();
    if (id) resetProductForm(); else { productForm.reset(); $('image-preview-wrap').classList.add('hidden'); }
  } catch (error) {
    console.error(error); message('product-message', error.message && !error.code ? error.message : safeError(error), true);
  } finally { button.disabled = false; button.textContent = $('product-id').value ? 'Guardar cambios' : 'Guardar producto'; }
});
$('bulk-images').addEventListener('change', (event) => {
  const input = event.currentTarget;
  agregarArchivosALote(input.files);
  input.value = '';
});
$('bulk-folder').addEventListener('change', (event) => {
  const input = event.currentTarget;
  agregarArchivosALote(input.files);
  input.value = '';
});
function agregarArchivosALote(files) {
  const seleccionados = [...(files || [])];
  if (!seleccionados.length) return;
  const claveArchivo = (file) => `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
  const existentes = new Set(bulkQueue.map((item) => claveArchivo(item.file)));
  const nuevos = [];
  const rechazados = [];
  for (const file of seleccionados) {
    const key = claveArchivo(file);
    if (existentes.has(key)) continue;
    try {
      validateImage(file);
      nuevos.push(file);
      existentes.add(key);
    } catch (error) {
      rechazados.push(`${file.name}: ${error.message}`);
    }
  }
  const disponibles = Math.max(0, 100 - bulkQueue.length);
  const paraAgregar = nuevos.slice(0, disponibles);
  for (const file of paraAgregar) {
    bulkQueue.push({
      id: nextBulkItemId++,
      file,
      productId: doc(collection(db, 'productos')).id,
      previewUrl: URL.createObjectURL(file),
      name: nombreInicial(file),
      price: '',
      category: '',
      error: '',
    });
  }
  if (paraAgregar.length < nuevos.length) {
    rechazados.push(`Solo se permiten 100 imágenes por lote; se añadieron ${paraAgregar.length} de las nuevas imágenes válidas.`);
  }
  renderBulkQueue();
  message(
    'bulk-message',
    rechazados.length
      ? `${paraAgregar.length} imagen(es) añadidas. ${rechazados.slice(0, 3).join(' · ')}`
      : `${paraAgregar.length} imagen(es) añadidas a la lista.`,
    rechazados.length > 0,
  );
}

$('bulk-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser || !esAdministrador(currentUser)) return message('bulk-message', 'Tu sesión no tiene permisos de administrador.', true);
  if (!bulkQueue.length) return message('bulk-message', 'Añade imágenes antes de guardar.', true);
  let invalid = false;
  for (const item of bulkQueue) {
    item.error = '';
    const price = Number(item.price);
    if (!item.name.trim()) item.error = 'Escribe el nombre de este producto.';
    else if (item.price === '' || !Number.isFinite(price) || price < 0) item.error = 'Escribe un precio válido para este producto.';
    else if (!item.category.trim()) item.error = 'Escribe o selecciona la categoría de este producto.';
    if (item.error) invalid = true;
  }
  if (invalid) {
    renderBulkQueue();
    return message('bulk-message', 'Completa el nombre, el precio y la categoría de cada imagen antes de guardar.', true);
  }

  const button = $('bulk-button'); button.disabled = true;
  bulkGuardando = true;
  renderBulkQueue();
  const guardados = new Set();
  const pendientes = [...bulkQueue];
  try {
    for (let index = 0; index < pendientes.length; index++) {
      const item = pendientes[index];
      message('bulk-message', `Guardando ${index + 1} de ${pendientes.length}: ${item.name}…`);
      try {
        const imageUrl = await uploadImage(item.file);
        await setDoc(doc(db, 'productos', item.productId), {
          nombre: item.name.trim(),
          precio: Number(item.price),
          categoria: item.category.trim(),
          imagen: imageUrl,
        });
        guardados.add(item.id);
      } catch (error) {
        item.error = error.message && !error.code ? error.message : safeError(error);
      }
    }
    bulkQueue = bulkQueue.filter((item) => {
      if (!guardados.has(item.id)) return true;
      URL.revokeObjectURL(item.previewUrl);
      return false;
    });
    renderBulkQueue();

    if (guardados.size) {
      try {
        await loadProducts();
      } catch (error) {
        console.error('Se guardaron productos, pero no se pudo actualizar la lista:', error);
        message(
          'bulk-message',
          `Se guardaron ${guardados.size} producto(s), pero no se pudo actualizar la lista. ${safeError(error)}`,
          true,
        );
        return;
      }
    }
    const fallidos = bulkQueue.length;
    message(
      'bulk-message',
      `${guardados.size} producto(s) guardado(s).${fallidos ? ` ${fallidos} imagen(es) siguen pendientes; revisa el error indicado en cada una.` : ''}`,
      fallidos > 0,
    );
  } catch (error) {
    console.error('No se pudo completar la carga por lote:', error);
    message('bulk-message', safeError(error), true);
  } finally {
    bulkGuardando = false;
    renderBulkQueue();
    button.disabled = bulkQueue.length === 0;
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user && esAdministrador(user)) {
    recordarPropietario();
    loginPanel.classList.add('hidden'); adminPanel.classList.remove('hidden');
    $('admin-email').textContent = `Sesión iniciada como ${user.email}`;
    try { await loadProducts(); message('global-message', 'Catálogo listo para administrar.'); }
    catch (error) {
      console.error('No se pudieron cargar los productos:', error);
      message('global-message', safeError(error), true);
      mostrarErrorCargaProductos(error);
    }
  } else {
    olvidarPropietario();
    adminPanel.classList.add('hidden'); loginPanel.classList.remove('hidden');
    if (user) { await signOut(auth); message('login-message', 'Esta cuenta no está autorizada para administrar la tienda.', true); }
  }
});
