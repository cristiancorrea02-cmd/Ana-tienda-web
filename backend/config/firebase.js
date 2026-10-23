// Conexión del servidor a Firestore (lectura pública del catálogo).
// Si no hay configuración o falla, `db` queda en null y el servicio usa el respaldo local.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import './env.js';

const {
  VITE_FIREBASE_API_KEY: apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: authDomain,
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_STORAGE_BUCKET: storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: messagingSenderId,
  VITE_FIREBASE_APP_ID: appId,
} = process.env;

export let db = null;

// El SDK de Firestore reintenta conectarse en segundo plano. Si la red falla (sin internet, proxy, etc.)
// puede emitir errores de socket sin dueño que, en Node, tumban todo el proceso. Se ignoran SOLO esos
// errores de red: el catálogo tiene respaldo local (backend/data/productos.json). Cualquier otro error
// sigue terminando el proceso, igual que antes.
const ERRORES_DE_RED = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN']);

process.on('uncaughtException', (error) => {
  if (!ERRORES_DE_RED.has(error?.code)) {
    console.error(error);
    process.exit(1);
  }
  console.warn(`Aviso: error de red ignorado (${error.code}). Se usa el respaldo local si hace falta.`);
});

process.on('unhandledRejection', (razon) => {
  if (!ERRORES_DE_RED.has(razon?.code)) throw razon;
  console.warn(`Aviso: error de red ignorado (${razon.code}). Se usa el respaldo local si hace falta.`);
});

if (projectId) {
  try {
    db = getFirestore(initializeApp({ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }));
  } catch (error) {
    console.warn('Aviso: No se pudo inicializar Firebase en el backend:', error.message);
  }
}
