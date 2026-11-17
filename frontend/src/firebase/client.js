
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let app = null;
let authInstance = null;
let dbInstance = null;
let configCargada = false;

async function cargarConfiguracion() {
  if (configCargada && app) return;

  try {
    const res = await fetch('/api/auth/config');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const config = await res.json();

    if (!config.apiKey || !config.projectId) {
      console.warn('[Firebase] Configuración incompleta recibida del servidor.');
    }

    app = getApps().length ? getApps()[0] : initializeApp(config);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    configCargada = true;
  } catch (error) {
    
    console.warn('[Firebase] No se pudo obtener la configuración del servidor. Usando respaldo local:', error.message);
    const configLocal = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
    app = getApps().length ? getApps()[0] : initializeApp(configLocal);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    configCargada = true;
  }
}

await cargarConfiguracion();

export const auth = authInstance;
export const db = dbInstance;
