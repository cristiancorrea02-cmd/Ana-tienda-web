import { collection, getDocs } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';
import { db } from '../config/firebase.js';

const RESPALDO_LOCAL = new URL('../data/productos.json', import.meta.url);

const ESPERA_MAXIMA_MS = 4000;
const PAUSA_TRAS_FALLO_MS = 30000;
let firestorePausadoHasta = 0;

function conLimiteDeTiempo(promesa, ms) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(`Firestore no respondió en ${ms / 1000} s`)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

export async function obtenerProductos() {
  if (db && Date.now() >= firestorePausadoHasta) {
    try {
      const snapshot = await conLimiteDeTiempo(getDocs(collection(db, 'productos')), ESPERA_MAXIMA_MS);
      if (!snapshot.empty) {
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (error) {
      firestorePausadoHasta = Date.now() + PAUSA_TRAS_FALLO_MS;
      console.warn('Aviso: Consulta a Firestore falló o está sin conexión. Usando respaldo local:', error.message);
    }
  }

  try {
    return JSON.parse(await readFile(RESPALDO_LOCAL, 'utf-8'));
  } catch (error) {
    console.error('Error al leer datos de productos:', error);
    throw new Error('No se pudo obtener el catálogo de Firestore ni del respaldo local.', { cause: error });
  }
}
