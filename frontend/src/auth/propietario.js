
export const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '')
  .trim()
  .toLowerCase();

const CLAVE_PISTA = 'adargeyi_owner_session'; 
const PARAM_ACCESO = 'admin'; 

const normalizar = (correo) => String(correo ?? '').trim().toLowerCase();

export function esAdministrador(user) {
  return Boolean(user && normalizar(user.email) === ADMIN_EMAIL && user.emailVerified);
}

export function recordarPropietario() {
  try {
    localStorage.setItem(CLAVE_PISTA, ADMIN_EMAIL);
  } catch {
    
  }
}

export function olvidarPropietario() {
  try {
    localStorage.removeItem(CLAVE_PISTA);
  } catch {
    
  }
}

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
    
  }
  return coincide;
}

function leerPistaGuardada() {
  try {
    return normalizar(localStorage.getItem(CLAVE_PISTA)) === ADMIN_EMAIL;
  } catch {
    return false;
  }
}

export function hayIndicioDePropietario() {
  return leerIntentoDeAcceso() || leerPistaGuardada();
}
