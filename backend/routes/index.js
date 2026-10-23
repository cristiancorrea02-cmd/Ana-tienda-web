// Enrutador de la API: tabla "MÉTODO /ruta" -> manejador.
import { obtenerProductos } from '../services/productos.js';

function responderJSON(res, estado, cuerpo) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo));
}

const rutas = {
  // Comprobación de salud del servidor
  'GET /api/health': (req, res) => {
    responderJSON(res, 200, { status: 'ok', server: 'tienda-web-backend', timestamp: new Date().toISOString() });
  },

  // Catálogo completo
  'GET /api/productos': async (req, res) => {
    const productos = await obtenerProductos();
    responderJSON(res, 200, productos);
    console.log(`[Backend] GET /api/productos - ${productos.length} productos enviados.`);
  },
};

export async function atender(req, res) {
  let pathname = 'URL desconocida';
  try {
    pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
    const manejador = rutas[`${req.method} ${pathname}`];

    if (!manejador) {
      const rutaExiste = Object.keys(rutas).some((ruta) => ruta.endsWith(` ${pathname}`));
      if (rutaExiste) {
        res.setHeader('Allow', 'GET, OPTIONS');
        responderJSON(res, 405, { error: 'Método no permitido' });
      } else {
        responderJSON(res, 404, { error: 'Ruta no encontrada' });
      }
      return;
    }

    await manejador(req, res);
  } catch (error) {
    console.error(`[Backend] Error al procesar ${req.method} ${pathname}:`, error);
    if (!res.headersSent) responderJSON(res, 500, { error: 'Error interno del servidor' });
  }
}
