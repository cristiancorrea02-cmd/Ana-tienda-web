
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
