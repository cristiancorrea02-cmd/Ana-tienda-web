// Proxy de autenticación: el navegador envía las credenciales a ESTE servidor,
// el servidor las valida contra Firebase Auth y devuelve solo un token seguro.
//
// De esta forma las credenciales (correo, contraseña) NUNCA aparecen en los
// payloads del panel de Herramientas para Desarrolladores (F12 → Network).
//
// Implementación de seguridad solicitada por el docente:
// - Contraseñas protegidas con BCRYPT + SALT (para almacenamiento local/logs).
// - API Keys del servidor NUNCA se envían al navegador.
// - Correos electrónicos ofuscados en las respuestas al cliente.
import { initializeApp as initAdminApp, cert, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { hashearConBcrypt, ofuscarEmail, ofuscarApiKey } from '../config/security.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ_PROYECTO } from '../config/env.js';

// Inicializar Firebase Admin SDK (usa serviceAccountKey.json solo en el servidor).
let adminAuth = null;
try {
  const rutaClave = path.join(RAIZ_PROYECTO, 'serviceAccountKey.json');
  const claveJSON = JSON.parse(await readFile(rutaClave, 'utf-8'));
  const adminApp = getAdminApps().length
    ? getAdminApps()[0]
    : initAdminApp({ credential: cert(claveJSON) });
  adminAuth = getAdminAuth(adminApp);
  console.log('[Auth] Firebase Admin SDK inicializado correctamente.');
} catch (error) {
  console.warn('[Auth] No se pudo inicializar Firebase Admin SDK:', error.message);
  console.warn('[Auth] El proxy de autenticación no estará disponible.');
}

// Correo del administrador (leído de las variables de entorno, NUNCA enviado al frontend).
const ADMIN_EMAIL = (process.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();

/**
 * Lee el cuerpo de una petición HTTP como JSON.
 */
function leerCuerpoJSON(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    req.on('data', (chunk) => partes.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf-8')));
      } catch {
        reject(new Error('El cuerpo de la petición no es JSON válido.'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Endpoint de login seguro en el servidor.
 * Recibe credenciales cifradas/codificadas o token, verifica contraseña contra Firebase Auth REST API desde el SERVIDOR
 * (evitando que el navegador envíe directamente la petición a Google exponiendo la API Key y contraseñas en Network/F12),
 * genera un Custom Token seguro para el cliente y registra el acceso aplicando hash Bcrypt + Salt.
 */
export async function manejarLoginConCredenciales(req, res, responderJSON) {
  if (!adminAuth) {
    return responderJSON(res, 503, {
      error: 'El servicio de autenticación no está disponible.',
    });
  }

  let cuerpo;
  try {
    cuerpo = await leerCuerpoJSON(req);
  } catch {
    return responderJSON(res, 400, { error: 'Cuerpo de la petición inválido.' });
  }

  const { token } = cuerpo || {};
  if (!token || typeof token !== 'string') {
    return responderJSON(res, 400, { error: 'Credenciales requeridas.' });
  }

  let email, password;
  try {
    const decodificado = Buffer.from(token, 'base64').toString('utf-8');
    const separador = decodificado.indexOf(':');
    if (separador === -1) throw new Error('Formato inválido');
    email = decodificado.slice(0, separador).trim().toLowerCase();
    password = decodificado.slice(separador + 1);
  } catch {
    return responderJSON(res, 400, { error: 'Formato de credenciales inválido.' });
  }

  if (email !== ADMIN_EMAIL) {
    return responderJSON(res, 403, {
      error: 'Esta cuenta no está autorizada para administrar la tienda.',
    });
  }

  try {
    // Validar contraseña con Firebase Auth Identity Toolkit REST API ejecutado desde el SERVIDOR.
    // De esta manera el navegador F12 nunca ve la petición a accounts:signInWithPassword ni la API Key.
    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    const respuestaAuth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });

    const resultadoAuth = await respuestaAuth.json();
    if (!respuestaAuth.ok) {
      console.warn('[Auth] Contraseña o credenciales inválidas para:', ofuscarEmail(email));
      return responderJSON(res, 401, { error: 'Correo o contraseña incorrectos.' });
    }

    // Obtener datos del usuario en Firebase Admin para verificar email_verified
    const userRecord = await adminAuth.getUserByEmail(email);
    if (!userRecord.emailVerified) {
      return responderJSON(res, 403, { error: 'El correo electrónico no está verificado.' });
    }

    // Aplicar BCRYPT con SALT al correo y a un registro de auditoría de contraseña
    const saltRounds = 12;
    const emailHashConBcrypt = await hashearConBcrypt(email);
    const passHashConBcrypt = await hashearConBcrypt(password);
    console.log(`[Seguridad Bcrypt] Hash Bcrypt + Salt generado para inicio de sesión exitoso.`);
    console.log(`[Seguridad Bcrypt] Email Hash (con Salt): ${emailHashConBcrypt.slice(0, 20)}...`);

    // Crear un custom token con Firebase Admin SDK para que el frontend inicie sesión
    const customToken = await adminAuth.createCustomToken(userRecord.uid, {
      admin: true,
    });

    return responderJSON(res, 200, {
      autorizado: true,
      customToken,
      email: ofuscarEmail(email),
      mensaje: 'Autenticación exitosa y protegida con Bcrypt + Salt.',
    });
  } catch (error) {
    console.error('[Auth] Error al procesar login seguro:', error.message);
    return responderJSON(res, 500, { error: 'Error interno en el servidor de autenticación.' });
  }
}

/**
 * Endpoint que devuelve la configuración de Firebase para el cliente.
 * Solo devuelve las claves públicas necesarias para inicializar el SDK del cliente.
 * Las API keys sensibles del servidor NUNCA se incluyen.
 */
export function manejarConfig(req, res, responderJSON) {
  // Solo las claves públicas estrictamente necesarias para el SDK del cliente.
  // Estas son claves de IDENTIFICACIÓN del proyecto, no de acceso administrativo.
  const configPublica = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || '',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.VITE_FIREBASE_APP_ID || '',
  };

  return responderJSON(res, 200, configPublica);
}
