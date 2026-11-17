import zlib from 'node:zlib';
import { obtenerProductos } from '../services/productos.js';
import { manejarLoginConCredenciales, manejarConfig } from './auth.js';
import { manejarListarPedidos, manejarActualizarPedido, manejarCrearPedido } from './pedidos.js';
import { verificarLimite } from '../config/rate-limit.js';

function responderJSON(req, res, estado, cuerpo, cabecerasExtra = {}) {
  const jsonString = JSON.stringify(cuerpo);
  const buffer = Buffer.from(jsonString, 'utf-8');
  const acceptEncoding = req.headers['accept-encoding'] || '';

  const cabeceras = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...cabecerasExtra,
  };

  if (buffer.length > 512) {
    if (acceptEncoding.includes('br')) {
      cabeceras['Content-Encoding'] = 'br';
      res.writeHead(estado, cabeceras);
      res.end(zlib.brotliCompressSync(buffer));
      return;
    }
    if (acceptEncoding.includes('gzip')) {
      cabeceras['Content-Encoding'] = 'gzip';
      res.writeHead(estado, cabeceras);
      res.end(zlib.gzipSync(buffer));
      return;
    }
    if (acceptEncoding.includes('deflate')) {
      cabeceras['Content-Encoding'] = 'deflate';
      res.writeHead(estado, cabeceras);
      res.end(zlib.deflateSync(buffer));
      return;
    }
  }

  cabeceras['Content-Length'] = buffer.length;
  res.writeHead(estado, cabeceras);
  res.end(buffer);
}

const rutas = {
  'GET /api/health': (req, res) => {
    responderJSON(req, res, 200, {
      status: 'ok',
      server: 'tienda-web-backend',
      timestamp: new Date().toISOString(),
    }, { 'Cache-Control': 'no-store' });
  },

  'GET /api/productos': async (req, res) => {
    const productos = await obtenerProductos();
    responderJSON(req, res, 200, productos, {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    });
  },

  'POST /api/auth/login': async (req, res) => {
    await manejarLoginConCredenciales(req, res, (r, s, b) => responderJSON(req, r, s, b, { 'Cache-Control': 'no-store' }));
  },

  'GET /api/auth/config': (req, res) => {
    manejarConfig(req, res, (r, s, b) => responderJSON(req, r, s, b, { 'Cache-Control': 'no-store' }));
  },

  'GET /api/pedidos': async (req, res) => {
    await manejarListarPedidos(req, res, (r, s, b) => responderJSON(req, r, s, b, { 'Cache-Control': 'no-store' }));
  },

  'POST /api/pedidos': async (req, res) => {
    await manejarCrearPedido(req, res, (r, s, b) => responderJSON(req, r, s, b, { 'Cache-Control': 'no-store' }));
  },
};

export async function atender(req, res) {
  let pathname = 'URL desconocida';
  try {
    pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
    const esSensible = pathname === '/api/auth/login' || (req.method === 'POST' && pathname === '/api/pedidos');
    const limite = verificarLimite(ip, esSensible ? 'estricto' : 'general');

    if (!limite.permitido) {
      responderJSON(req, res, 429, {
        error: `Límite de solicitudes superado. Intenta de nuevo en ${limite.reintentarEn || 60} segundos.`,
      }, { 'Retry-After': String(limite.reintentarEn || 60) });
      return;
    }

    const manejador = rutas[`${req.method} ${pathname}`];

    if (!manejador && req.method === 'PATCH' && pathname.startsWith('/api/pedidos/')) {
      const pedidoId = pathname.split('/api/pedidos/')[1];
      if (pedidoId) {
        await manejarActualizarPedido(req, res, (r, s, b) => responderJSON(req, r, s, b, { 'Cache-Control': 'no-store' }), pedidoId);
        return;
      }
    }

    if (!manejador) {
      const rutaExiste = Object.keys(rutas).some((ruta) => ruta.endsWith(` ${pathname}`));
      if (rutaExiste) {
        res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS');
        responderJSON(req, res, 405, { error: 'Método no permitido' });
      } else {
        responderJSON(req, res, 404, { error: 'Ruta no encontrada' });
      }
      return;
    }

    await manejador(req, res);
  } catch (error) {
    console.error(`Error procesando ${req.method} ${pathname}:`, error?.message);
    try {
      responderJSON(req, res, 500, { error: 'Ocurrió un error inesperado al procesar la solicitud.' });
    } catch {
      res.writeHead(500);
      res.end();
    }
  }
}
