import { esAdministrador, recordarPropietario } from './propietario.js';
import { ADMIN_ROUTE } from '../admin-route.js';

const CLASES =
  'inline-flex items-center gap-1.5 justify-center px-3.5 py-1.5 text-xs font-semibold tracking-wider ' +
  'border border-control text-tinta hover:border-acento hover:text-acento rounded-full transition ' +
  'focus-visible:ring-2 focus-visible:ring-acento cursor-pointer';

function mostrarBoton(contenedor, texto) {
  let enlace = contenedor.querySelector('a');
  if (!enlace) {
    enlace = document.createElement('a');
    enlace.href = ADMIN_ROUTE;
    enlace.className = CLASES;
    enlace.innerHTML = `
      <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
      </svg>
      <span class="btn-text"></span>
    `;
    contenedor.append(enlace);
  }
  const span = enlace.querySelector('.btn-text');
  if (span) span.textContent = texto;
}

export async function iniciarBotonAcceso() {
  const contenedor = document.getElementById('acceso-propietario');
  if (!contenedor) return;

  mostrarBoton(contenedor, 'Acceso Propietario');

  try {
    const [{ auth }, { onAuthStateChanged }] = await Promise.all([
      import('../firebase/client.js'),
      import('firebase/auth'),
    ]);
    onAuthStateChanged(auth, (user) => {
      if (esAdministrador(user)) {
        recordarPropietario();
        mostrarBoton(contenedor, 'Panel Propietario');
      } else {
        mostrarBoton(contenedor, 'Acceso Propietario');
      }
    });
  } catch (error) {
    console.debug('[Auth] No se pudo comprobar la sesión de Firebase:', error?.message);
  }
}
