# Adargeyi · tienda-web

Catálogo en línea de la tienda. Dos carpetas con responsabilidades separadas:

```
tienda-web/
├── frontend/                  ← TODO lo que se ejecuta en el navegador
│   ├── index.html, <ruta-privada>.html vistas (catálogo público y panel privado)
│   ├── public/                    imágenes: portada, íconos y productos/<categoría>/*.webp
│   ├── src/
│   │   ├── main.js, catalogo.js       página pública
│   │   ├── admin.js                   panel de administración
│   │   ├── auth/                      quién es el propietario y su botón «Iniciar sesión»
│   │   ├── firebase/client.js         conexión de Firebase para el navegador
│   │   ├── services/productos.js      lectura del catálogo
│   │   └── style.css                  paleta y estilos (Tailwind)
│   └── vite.config.js, package.json   herramientas del cliente (genera frontend/dist)
│
├── backend/                   ← servidor, datos y seguridad
│   ├── server.js                  arranque del servidor HTTP
│   ├── routes/index.js            enrutador: GET /api/health, GET /api/productos, errores HTTP
│   ├── services/productos.js      lógica del catálogo (Firestore, con respaldo local)
│   ├── config/                    configuración local opcional y conexión a Firestore
│   ├── data/productos.json        respaldo local del catálogo
│   ├── scripts/                   procesar-imagenes.js y seed-firestore.js
│   ├── firestore/                 reglas de seguridad e índices de Firestore
│   └── package.json
│
├── firebase.json, .firebaserc ← despliegue (el CLI de Firebase los exige en la raíz)
├── .env.example               ← plantilla opcional de configuración pública local
└── package.json               ← raíz: une frontend y backend con npm workspaces
```

## Cómo usarlo

```bash
npm install            # una sola vez: instala frontend y backend
npm run dev            # sitio en http://localhost:5173
npm run dev:backend    # API en http://localhost:3001 (el sitio la usa como respaldo vía /api)
npm run build          # compila el sitio en frontend/dist
npm run seed:prueba    # valida backend/data/productos.json sin subir nada
npm run seed           # sube los productos a Firestore (necesita credenciales ADC)
npm run procesar       # convierte las fotos de imagenes-originales/ en WebP y regenera productos.json
npm run deploy:firebase   # compila y publica sitio + reglas de Firestore
```

Para recibir variables desde Infisical al iniciar procesos o compilar:

```bash
npm run dev:infisical
npm run dev:backend:infisical  # en otra terminal
npm run build:infisical
npm run deploy:firebase:infisical
npm run seed:infisical
```

Requiere Node 20.19 o superior.

## Secretos, credenciales y escaneo

- Instala [Infisical CLI](https://infisical.com/docs/cli/overview), ejecuta `infisical login` e
  `infisical init`, y crea los entornos `dev` y `prod`. Guarda allí las variables necesarias para
  el build y el backend. Los comandos `*:infisical` ejecutan cada proceso con esas variables;
  no se escriben en archivos `.env`. La configuración generada por Infisical vincula el proyecto,
  pero no contiene los valores de los secretos.
- `VITE_*` **no son secretos**: Vite los incorpora al JavaScript que recibe cada navegador. En
  particular, `VITE_FIREBASE_API_KEY` es configuración pública de Firebase, no una contraseña.
  Puedes centralizarla en Infisical para el build, pero no se puede ocultar allí del usuario final.
  Restringe esa API key en Google Cloud y protege los datos con reglas de Firestore. Nunca uses
  el prefijo `VITE_` para contraseñas SMTP, tokens privados ni credenciales de administrador.
- No hay actualmente un servicio de correo ni credenciales SMTP/API de correo en la aplicación.
  Si se añade uno, guarda sus credenciales en Infisical y consúmelas únicamente desde un backend
  de confianza; no las almacenes en Firestore ni las envíes al navegador. El correo de login del
  propietario también es visible en el cliente y en las reglas de autorización; cifrarlo allí no
  lo convertiría en privado.
- Los scripts de Firebase Admin usan Application Default Credentials (ADC), no cargan claves
  privadas JSON. En desarrollo local, autentícate con `gcloud auth application-default login`;
  en producción, asigna al servicio una identidad de Google Cloud con los permisos mínimos
  necesarios. ADC también admite `GOOGLE_APPLICATION_CREDENTIALS`, pero esa modalidad requiere
  un archivo de credenciales; evita generar o distribuir claves de cuenta de servicio si puedes
  usar una identidad administrada. Revoca las claves antiguas cuando hayas confirmado que ya no
  se usan.
- `.env*` está excluido de Git (salvo `.env.example`). No guardes secretos reales en ese ejemplo.
- Instala [Gitleaks](https://github.com/gitleaks/gitleaks/releases) y, desde la raíz del repositorio,
  activa el hook local con `git config core.hooksPath .githooks`. El hook bloquea el `push` si
  encuentra secretos en el historial local; requiere que `gitleaks` esté instalado. El workflow
  `.github/workflows/secret-scan.yml` añade un escaneo en GitHub como segunda barrera, pero no
  sustituye el hook local. Si se detecta una credencial expuesta, revócala y rótala: borrarla del
  último commit no invalida la clave.

## Seguridad de Firebase

- La aplicación usa Firestore, no SQL; no hay consultas SQL que parametrizar. Las reglas de
  Firestore deniegan escrituras no autorizadas. No hay actualmente un WAF configurado: Firebase
  Hosting estático no se protege con Cloud Armor directamente. Para blindar el acceso a Firebase,
  configura Firebase App Check y exige su validación para Firestore desde la consola. Si se publica
  el backend en Cloud Run, Cloud Armor requiere ponerlo detrás de un balanceador compatible.
- **Quién puede cambiar el catálogo lo decide Google, no el navegador**: Firebase Auth +
  `backend/firestore/firestore.rules` (solo la cuenta propietaria verificada puede escribir).
- La tienda distingue un catálogo vacío de un fallo al cargarlo y permite reintentar. La API responde
  `404` para rutas inexistentes, `405` para métodos no permitidos y `500` para errores internos;
  el panel presenta mensajes más claros para conexión, permisos y operaciones rechazadas.
- La carga por lote del panel permite añadir imágenes desde múltiples selecciones y revisar
  individualmente nombre, precio y categoría antes de guardarlas. Los elementos incompletos o con
  errores permanecen en la lista para corregirlos sin volver a seleccionar los archivos.
- El botón «Iniciar sesión» de la barra **no existe en el HTML público**. `frontend/src/auth/` lo crea
  solo si detecta al propietario (sesión de Firebase, sesión local recordada o intento de acceso). Es una
  comodidad de la interfaz, no una barrera: la barrera son las reglas de Firestore.
- La ruta del panel es `/quHoZ3ckEc9rLuBMpbcf`. En un navegador nuevo, abre
  `/?admin=correacristian798@gmail.com` para mostrar el botón de acceso; el parámetro se borra de la
  barra de direcciones. La ruta aleatoria solo reduce el descubrimiento casual: Firebase Auth y las
  reglas de Firestore siguen siendo la protección real. Al cerrar sesión en el panel, el botón vuelve
  a ocultarse.
- El correo del propietario está en dos sitios que deben coincidir: `frontend/src/auth/propietario.js`
  (o `VITE_ADMIN_EMAIL` desde Infisical o un `.env` local) y `backend/firestore/firestore.rules`.

## Paleta y accesibilidad (WCAG 2.1 AA)

Todos los textos, botones y bordes de elementos interactivos superan 4.5:1. Los valores medidos
están documentados en `frontend/src/style.css`. Regla práctica: `border-borde` es solo decorativo
(tarjetas, separadores); para campos, filtros y botones de contorno se usa `border-control`.
