// Rutas para gestionar los pedidos de los clientes.
// El administrador puede ver los pedidos hechos desde el carrito de la tienda.
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';

/**
 * Crea un pedido nuevo en Firestore (enviado desde el carrito de la tienda).
 */
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

  const { clienteNombre, clienteTelefono, productos, total } = cuerpo || {};
  if (!productos || !Array.isArray(productos) || productos.length === 0) {
    return responderJSON(res, 400, { error: 'El pedido debe contener productos.' });
  }

  try {
    const nuevoPedido = {
      clienteNombre: (clienteNombre || 'Cliente anónimo').trim(),
      clienteTelefono: (clienteTelefono || '').trim(),
      productos: productos.map((p) => ({
        nombre: p.nombre || 'Producto',
        cantidad: Number(p.cantidad || 1),
        precio: Number(p.precio || 0),
      })),
      total: Number(total || 0),
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

/**
 * Obtiene todos los pedidos almacenados en Firestore.
 * Ordena por fecha de creación (más recientes primero).
 */
export async function manejarListarPedidos(req, res, responderJSON) {
  if (!db) {
    return responderJSON(res, 503, { error: 'Base de datos no disponible.' });
  }

  try {
    let snapshot;
    try {
      snapshot = await getDocs(query(collection(db, 'pedidos'), orderBy('creadoEn', 'desc')));
    } catch {
      // Si el índice no existe, intentar sin orden.
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

/**
 * Actualiza el estado de un pedido (por ejemplo: "pendiente" → "completado").
 */
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
