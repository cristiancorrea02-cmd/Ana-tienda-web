import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_ROUTE } from './src/admin-route.js';

// Carpeta frontend/ (donde está este archivo), sin depender del directorio desde el que se ejecute.
const FRONTEND = path.dirname(fileURLToPath(import.meta.url));

const rutaAdminPlugin = {
  name: 'private-admin-dev-route',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] === ADMIN_ROUTE) {
        req.url = req.url.replace(ADMIN_ROUTE, `${ADMIN_ROUTE}.html`);
      }
      next();
    });
  },
};

export default defineConfig({
  root: FRONTEND,
  // El archivo .env está en la raíz del proyecto, un nivel arriba de frontend/.
  envDir: path.resolve(FRONTEND, '..'),
  publicDir: path.resolve(FRONTEND, 'public'),
  build: {
    // El sitio compilado queda en frontend/dist (es lo que publica Firebase Hosting).
    outDir: path.resolve(FRONTEND, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(FRONTEND, 'index.html'),
        [ADMIN_ROUTE.slice(1)]: path.resolve(FRONTEND, `${ADMIN_ROUTE.slice(1)}.html`),
      },
    },
  },
  server: {
    port: 5173,
    // En desarrollo, /api/* se reenvía al servidor de backend/ (npm run dev:backend).
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [tailwindcss(), rutaAdminPlugin],
});
