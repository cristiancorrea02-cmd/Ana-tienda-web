import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/client.js';

function errorDeCarga(errorFirestore, errorApi) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new Error('No hay conexión a internet. Revisa tu conexión e inténtalo de nuevo.');
  }

  const estado = errorApi?.status;
  if (estado === 404 || estado >= 500) {
    return new Error('El servicio del catálogo no está disponible en este momento. Inténtalo de nuevo más tarde.');
  }
  if (estado >= 400) {
    return new Error('No pudimos solicitar el catálogo. Recarga la página o inténtalo de nuevo más tarde.');
  }
  if (errorFirestore?.code === 'permission-denied') {
    return new Error('No se pudo consultar el catálogo por un problema de permisos. Inténtalo de nuevo más tarde.');
  }
  return new Error('No pudimos conectar con el catálogo. Comprueba tu conexión e inténtalo de nuevo.');
}

export async function obtenerProductos() {
  let errorFirestore;

  // 1. Intentar consultar directamente Firestore si está disponible.
  if (db) {
    try {
      const ref = collection(db, 'productos');
      let snapshot;
      try {
        snapshot = await getDocs(query(ref, orderBy('nombre')));
      } catch (orderError) {
        if (orderError?.code === 'failed-precondition' || orderError?.code === 'invalid-argument') {
          snapshot = await getDocs(ref);
        } else {
          throw orderError;
        }
      }
      if (snapshot && !snapshot.empty) {
        return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      }
    } catch (firestoreError) {
      errorFirestore = firestoreError;
      console.warn('[Catálogo] Firestore sin datos o sin conexión. Consultando endpoint API backend...', firestoreError.message);
    }
  }

  // 2. Respaldo a la API del servidor (/api/productos).
  let data;
  try {
    const res = await fetch('/api/productos');
    if (!res.ok) {
      const error = new Error(`El servicio del catálogo respondió con HTTP ${res.status}.`);
      error.status = res.status;
      throw error;
    }

    data = await res.json();
    if (!Array.isArray(data)) throw new Error('La respuesta del catálogo no tiene un formato válido.');
  } catch (apiError) {
    console.warn('[Catálogo] Endpoint API backend no disponible:', apiError.message);
    throw errorDeCarga(errorFirestore, apiError);
  }

  if (data.length > 0) return data;
  if (errorFirestore) throw errorDeCarga(errorFirestore);
  return [];
}
