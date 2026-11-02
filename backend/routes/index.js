// Enrutador de la API: tabla "MÉTODO /ruta" -> manejador.
// Incluye las rutas de autenticación segura y gestión de pedidos.
import { obtenerProductos } from '../services/productos.js';
import { manejarLoginConCredenciales, manejarConfig } from './auth.js';
import { manejarListarPedidos, manejarActualizarPedido, manejarCrearPedido } from './pedidos.js';

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

  // SEGURIDAD: Proxy de autenticación seguro (las credenciales no se exponen a Google desde el cliente).
  'POST /api/auth/login': async (req, res) => {
    await manejarLoginConCredenciales(req, res, responderJSON);
  },

  // SEGURIDAD: Configuración pública de Firebase (servida desde el backend, no hardcodeada).
  'GET /api/auth/config': (req, res) => {
    manejarConfig(req, res, responderJSON);
  },

  // PEDIDOS: Listar todos los pedidos (para el panel administrativo).
  'GET /api/pedidos': async (req, res) => {
    await manejarListarPedidos(req, res, responderJSON);
  },

  // PEDIDOS: Crear un nuevo pedido desde el cliente
  'POST /api/pedidos': async (req, res) => {
    await manejarCrearPedido(req, res, responderJSON);
  },
};

export async function atender(req, res) {
  let pathname = 'URL desconocida';
  try {
    pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
    const manejador = rutas[`${req.method} ${pathname}`];

    // Ruta dinámica: PATCH /api/pedidos/:id
    if (!manejador && req.method === 'PATCH' && pathname.startsWith('/api/pedidos/')) {
      const pedidoId = pathname.split('/api/pedidos/')[1];
      if (pedidoId) {
        await manejarActualizarPedido(req, res, responderJSON, pedidoId);
        return;
      }
    }

    if (!manejador) {
      const rutaExiste = Object.keys(rutas).some((ruta) => ruta.endsWith(` ${pathname}`));
      if (rutaExiste) {
        res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS');
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
