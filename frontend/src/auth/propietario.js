// Identidad del propietario de la tienda: única fuente de verdad en el frontend.
//
// IMPORTANTE: esto solo decide qué se MUESTRA (por ejemplo, el botón «Iniciar sesión»).
// Quién puede MODIFICAR el catálogo lo decide el servidor de Google:
// Firebase Auth + backend/firestore/firestore.rules (que repite este mismo correo).

// Debe coincidir con el correo de backend/firestore/firestore.rules.
export const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || 'correacristian798@gmail.com')
  .trim()
  .toLowerCase();

const CLAVE_PISTA = 'adargeyi_owner_session'; // localStorage: "este navegador ya reconoció al propietario"
const PARAM_ACCESO = 'admin'; //                  URL de intento de acceso: /?admin=<correo del propietario>

const normalizar = (correo) => String(correo ?? '').trim().toLowerCase();

// Usuario de Firebase Auth que es el propietario (correo coincide y está verificado, igual que las reglas).
export function esAdministrador(user) {
  return Boolean(user && normalizar(user.email) === ADMIN_EMAIL && user.emailVerified);
}

export function recordarPropietario() {
  try {
    localStorage.setItem(CLAVE_PISTA, ADMIN_EMAIL);
  } catch {
    // Almacenamiento bloqueado (modo privado, etc.): el botón simplemente no se recordará.
  }
}

export function olvidarPropietario() {
  try {
    localStorage.removeItem(CLAVE_PISTA);
  } catch {
    // Nada que borrar si el almacenamiento no está disponible.
  }
}

// Intento de acceso: la URL trae ?admin=<correo>. Si es el del propietario se recuerda,
// y en cualquier caso el parámetro se borra de la barra de direcciones (no queda en el historial).
function leerIntentoDeAcceso() {
  let coincide = false;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PARAM_ACCESO)) return false;
    coincide = normalizar(url.searchParams.get(PARAM_ACCESO)) === ADMIN_EMAIL;
    if (coincide) recordarPropietario();
    url.searchParams.delete(PARAM_ACCESO);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch {
    // Sin acceso a la URL o al historial: se ignora.
  }
  return coincide;
}

// Sesión previa: este navegador ya reconoció al propietario antes.
function leerPistaGuardada() {
  try {
    return normalizar(localStorage.getItem(CLAVE_PISTA)) === ADMIN_EMAIL;
  } catch {
    return false;
  }
}

// ¿Hay indicios de que quien visita es el propietario? (intento de acceso o sesión previa)
export function hayIndicioDePropietario() {
  return leerIntentoDeAcceso() || leerPistaGuardada();
}
