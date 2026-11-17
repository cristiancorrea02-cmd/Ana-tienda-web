import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';

const pedidosRecientes = new Map();
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, tiempo] of pedidosRecientes.entries()) {
    if (ahora - tiempo > 30000) pedidosRecientes.delete(clave);
  }
}, 15000).unref();

export async function manejarCrearPedido(req, res, responderJSON) {
  if (!db) {
    return responderJSON(res, 503, { error: 'Base de datos no disponible.' });
  }

  let cuerpo;
  try {
    const partes = [];
    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => partes.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    cuerpo = JSON.parse(Buffer.concat(partes).toString('utf-8'));
  } catch {
    return responderJSON(res, 400, { error: 'Cuerpo de la petición inválido.' });
  }

  const { clienteNombre, clienteTelefono, tipoEntrega, direccion, notas, productos } = cuerpo || {};

  const nombreLimpio = String(clienteNombre || '').trim();
  if (nombreLimpio.length < 2 || nombreLimpio.length > 100) {
    return responderJSON(res, 400, { error: 'El nombre debe tener entre 2 y 100 caracteres.' });
  }

  const telefonoLimpio = String(clienteTelefono || '').trim();
  if (telefonoLimpio.length > 30) {
    return responderJSON(res, 400, { error: 'El teléfono no puede superar los 30 caracteres.' });
  }

  const entregaValida = tipoEntrega === 'domicilio' ? 'domicilio' : 'recogida';
  const direccionLimpia = String(direccion || '').trim();
  if (entregaValida === 'domicilio' && direccionLimpia.length < 5) {
    return responderJSON(res, 400, { error: 'Para entrega a domicilio se requiere una dirección válida.' });
  }

  if (!productos || !Array.isArray(productos) || productos.length === 0 || productos.length > 100) {
    return responderJSON(res, 400, { error: 'El pedido debe contener entre 1 y 100 productos.' });
  }

  const productosValidados = [];
  let totalCalculado = 0;

  for (const item of productos) {
    const nombreProd = String(item.nombre || '').trim();
    const cantidad = Math.max(1, Math.min(1000, Math.floor(Number(item.cantidad || 1))));
    const precio = Math.max(0, Math.floor(Number(item.precio || 0)));

    if (!nombreProd) {
      return responderJSON(res, 400, { error: 'Uno de los productos no tiene nombre válido.' });
    }

    productosValidados.push({
      nombre: nombreProd,
      cantidad,
      precio,
    });
    totalCalculado += precio * cantidad;
  }

  const firmaPedido = `${nombreLimpio}:${entregaValida}:${totalCalculado}:${productosValidados.length}`;
  const ultimoEnvio = pedidosRecientes.get(firmaPedido);
  const ahora = Date.now();
  if (ultimoEnvio && ahora - ultimoEnvio < 10000) {
    return responderJSON(res, 429, { error: 'Ya recibimos un pedido idéntico hace unos momentos. Por favor espera antes de enviar otro.' });
  }
  pedidosRecientes.set(firmaPedido, ahora);

  try {
    const nuevoPedido = {
      clienteNombre: nombreLimpio,
      clienteTelefono: telefonoLimpio,
      tipoEntrega: entregaValida,
      direccion: entregaValida === 'domicilio' ? direccionLimpia : '',
      notas: String(notas || '').trim().slice(0, 300),
      productos: productosValidados,
      total: totalCalculado,
      estado: 'pendiente',
      creadoEn: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'pedidos'), nuevoPedido);
    return responderJSON(res, 201, {
      mensaje: 'Pedido creado exitosamente.',
      id: docRef.id,
      pedido: nuevoPedido,
    });
  } catch (error) {
    console.error('[Pedidos] Error al crear pedido:', error.message);
    return responderJSON(res, 500, { error: 'No se pudo crear el pedido.' });
  }
}

export async function manejarListarPedidos(req, res, responderJSON) {
  if (!db) {
    return responderJSON(res, 503, { error: 'Base de datos no disponible.' });
  }

  try {
    let snapshot;
    try {
      snapshot = await getDocs(query(collection(db, 'pedidos'), orderBy('creadoEn', 'desc')));
    } catch {
      snapshot = await getDocs(collection(db, 'pedidos'));
    }

    const pedidos = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    return responderJSON(res, 200, pedidos);
  } catch (error) {
    console.error('[Pedidos] Error al obtener pedidos:', error.message);
    return responderJSON(res, 500, { error: 'No se pudieron obtener los pedidos.' });
  }
}

export async function manejarActualizarPedido(req, res, responderJSON, pedidoId) {
  if (!db) {
    return responderJSON(res, 503, { error: 'Base de datos no disponible.' });
  }

  let cuerpo;
  try {
    const partes = [];
    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => partes.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    cuerpo = JSON.parse(Buffer.concat(partes).toString('utf-8'));
  } catch {
    return responderJSON(res, 400, { error: 'Cuerpo de la petición inválido.' });
  }

  const { estado } = cuerpo || {};
  const estadosValidos = ['pendiente', 'en_proceso', 'completado', 'cancelado'];
  if (!estado || !estadosValidos.includes(estado)) {
    return responderJSON(res, 400, {
      error: `Estado inválido. Estados válidos: ${estadosValidos.join(', ')}`,
    });
  }

  try {
    await updateDoc(doc(db, 'pedidos', pedidoId), {
      estado,
      actualizadoEn: new Date().toISOString(),
    });
    return responderJSON(res, 200, { mensaje: 'Pedido actualizado correctamente.', estado });
  } catch (error) {
    console.error('[Pedidos] Error al actualizar pedido:', error.message);
    return responderJSON(res, 500, { error: 'No se pudo actualizar el pedido.' });
  }
}
