import http from 'node:http';
import './config/env.js';
import { atender } from './routes/index.js';

const PORT = process.env.PORT || 3001;

// API pública de solo lectura: se permite consultarla desde cualquier origen.
function agregarCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req, res) => {
  agregarCors(res);

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  await atender(req, res);
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` Servidor Backend corriendo en:`);
  console.log(` http://localhost:${PORT}`);
  console.log(` Endpoint API: http://localhost:${PORT}/api/productos`);
  console.log(` Endpoint Salud: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);
});
