// Marca como "verificado" el correo del propietario en Firebase Authentication.
// Las reglas de Firestore exigen email_verified == true para poder escribir en el catálogo; una cuenta
// creada a mano en la consola de Firebase nace sin verificar y el panel la rechazaría.
//
// Uso (desde la raíz del proyecto):
//   npm run verificar-propietario
//   npm run verificar-propietario -- otro@correo.com      (si cambiaste de correo)
//
// Usa credenciales ADC: identidad del entorno en producción o `gcloud auth application-default login` localmente.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import '../config/env.js';

const correo = (process.argv[2] || process.env.VITE_ADMIN_EMAIL || 'correacristian798@gmail.com').trim().toLowerCase();

const projectId = process.env.GOOGLE_CLOUD_PROJECT
  || process.env.GCLOUD_PROJECT
  || process.env.VITE_FIREBASE_PROJECT_ID;
initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
});
const auth = getAuth();

let usuario;
try {
  usuario = await auth.getUserByEmail(correo);
} catch (error) {
  if (error.code === 'auth/user-not-found') {
    console.error(`No existe ninguna cuenta con el correo ${correo} en Firebase Authentication.`);
    console.error('Créala en la consola de Firebase (Authentication > Users > Add user) y vuelve a ejecutar este comando.');
  } else {
    console.error('No se pudo consultar Firebase Authentication:', error.message);
  }
  process.exit(1);
}

if (usuario.emailVerified) {
  console.log(`${correo} ya estaba verificado. No hay nada que cambiar.`);
} else {
  await auth.updateUser(usuario.uid, { emailVerified: true });
  console.log(`Listo: ${correo} quedó verificado.`);
}
console.log('Si ya habías iniciado sesión en el panel, ciérrala y vuelve a entrar para que el cambio se aplique.');
