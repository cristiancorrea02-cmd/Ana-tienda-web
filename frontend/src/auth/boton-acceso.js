// Botón «Iniciar sesión» de la barra de navegación: SOLO para el propietario.
//
// El HTML público no contiene el botón: este módulo lo crea dentro de <span id="acceso-propietario">
// únicamente cuando detecta al propietario, así que los visitantes no lo tienen ni en el DOM.
import { esAdministrador, hayIndicioDePropietario, recordarPropietario } from './propietario.js';
import { ADMIN_ROUTE } from '../admin-route.js';

const CLASES =
  'inline-flex items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-wider ' +
  'border-2 border-acento text-acento hover:bg-acento hover:text-white rounded-full transition ' +
  'focus-visible:ring-2 focus-visible:ring-acento';

function mostrarBoton(contenedor, texto) {
  let enlace = contenedor.querySelector('a');
  if (!enlace) {
    enlace = document.createElement('a');
    enlace.href = ADMIN_ROUTE;
    enlace.className = CLASES;
    contenedor.append(enlace);
  }
  enlace.textContent = texto;
}

export async function iniciarBotonAcceso() {
  const contenedor = document.getElementById('acceso-propietario');
  if (!contenedor) return;

  // 1. Intento de acceso (?admin=correo) o sesión previa recordada: aparece al instante.
  if (hayIndicioDePropietario()) mostrarBoton(contenedor, 'Iniciar sesión');

  // 2. Sesión real de Firebase Auth: si ya está dentro, el botón lleva directo al panel.
  try {
    const [{ auth }, { onAuthStateChanged }] = await Promise.all([
      import('../firebase/client.js'),
      import('firebase/auth'),
    ]);
    onAuthStateChanged(auth, (user) => {
      if (!esAdministrador(user)) return;
      recordarPropietario();
      mostrarBoton(contenedor, 'Panel de administración');
    });
  } catch (error) {
    console.debug('[Auth] No se pudo comprobar la sesión de Firebase:', error?.message);
  }
}
