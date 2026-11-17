import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARCHIVO_PRODUCTOS = path.resolve(__dirname, '../data/productos.json');

const COLECCION = 'productos';
const soloPrueba = process.argv.includes('--dry-run');

function validar(productos) {
  const problemas = [];
  const ids = new Set();
  productos.forEach((p, i) => {
    const donde = `#${i + 1} (${p.nombre || 'sin nombre'})`;
    if (!p.id || typeof p.id !== 'string') problemas.push(`${donde}: falta el id`);
    else if (ids.has(p.id)) problemas.push(`${donde}: id repetido "${p.id}"`);
    else ids.add(p.id);
    if (!p.nombre || typeof p.nombre !== 'string') problemas.push(`${donde}: falta el nombre`);
    if (!Number.isInteger(p.precio) || p.precio <= 0) problemas.push(`${donde}: el precio debe ser un número entero mayor que 0`);
    if (!p.categoria) problemas.push(`${donde}: falta la categoría`);
    if (!p.imagen || !p.imagen.startsWith('/productos/')) problemas.push(`${donde}: la imagen debe empezar por /productos/`);
  });
  return problemas;
}

const productos = JSON.parse(await readFile(ARCHIVO_PRODUCTOS, 'utf-8'));
const problemas = validar(productos);
if (problemas.length) {
  console.error(`Hay problemas en ${ARCHIVO_PRODUCTOS}:`);
  problemas.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

const porCategoria = {};
for (const p of productos) porCategoria[p.categoria] = (porCategoria[p.categoria] || 0) + 1;
console.log(`${productos.length} productos válidos:`);
for (const [cat, n] of Object.entries(porCategoria)) console.log(`  ${cat}: ${n}`);

if (soloPrueba) {
  console.log('\nPrueba terminada: no se subió nada a Firebase.');
  process.exit(0);
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT
  || process.env.GCLOUD_PROJECT
  || process.env.VITE_FIREBASE_PROJECT_ID;
initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
});
const db = getFirestore();

console.log(`\nSubiendo a Firestore${projectId ? `, proyecto "${projectId}"` : ''}...`);

const TAMANO_LOTE = 400;
for (let i = 0; i < productos.length; i += TAMANO_LOTE) {
  const lote = db.batch();
  for (const { id, ...datos } of productos.slice(i, i + TAMANO_LOTE)) {
    lote.set(db.collection(COLECCION).doc(id), datos);
  }
  await lote.commit();
  console.log(`  ${Math.min(i + TAMANO_LOTE, productos.length)} / ${productos.length}`);
}

console.log('\nListo. Los productos ya están en la colección "productos".');
