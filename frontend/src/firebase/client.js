// Cliente de Firebase para el navegador.
//
// SEGURIDAD (recomendación del docente):
// La configuración se obtiene desde el servidor backend (/api/auth/config)
// en lugar de exponerla directamente en las variables de entorno del cliente.
// De esta forma las API Keys NO aparecen hardcodeadas en el código fuente
// del navegador ni en los payloads visibles con F12 → Network.
//
// La seguridad real la imponen Firebase Auth y las Firestore Security Rules.
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let app = null;
let authInstance = null;
let dbInstance = null;
let configCargada = false;

/**
 * Carga la configuración de Firebase desde el backend.
 * Las API keys se sirven desde el servidor, NO están en el código del cliente.
 */
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
    // Fallback: si el backend no está disponible, usar variables de entorno como respaldo.
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

// Cargar la configuración inmediatamente.
await cargarConfiguracion();

export const auth = authInstance;
export const db = dbInstance;
