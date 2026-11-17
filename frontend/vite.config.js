import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_ROUTE } from './src/admin-route.js';

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
  
  envDir: path.resolve(FRONTEND, '..'),
  publicDir: path.resolve(FRONTEND, 'public'),
  build: {
    
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
    
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [tailwindcss(), rutaAdminPlugin],
});
