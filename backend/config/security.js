// Módulo de seguridad: hash con bcrypt + salt para datos sensibles.
// Implementa las recomendaciones del docente: SALT + algoritmo lento (BCRYPT).
//
// bcrypt genera automáticamente un salt aleatorio de 16 bytes y lo incorpora
// en el hash resultante. El "cost factor" (saltRounds) controla cuán lento
// es el algoritmo: a más rondas, más difícil de romper por fuerza bruta.
import bcrypt from 'bcryptjs';

// Número de rondas de salt. 12 es un buen balance entre seguridad y rendimiento.
// Cada incremento duplica el tiempo de cómputo.
const SALT_ROUNDS = 12;

/**
 * Genera un hash seguro con bcrypt + salt automático.
 * @param {string} textoPlano - El texto a hashear (contraseña, etc.)
 * @returns {Promise<string>} Hash bcrypt con salt incorporado.
 */
export async function hashearConBcrypt(textoPlano) {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(textoPlano, salt);
}

/**
 * Verifica si un texto plano coincide con un hash bcrypt.
 * @param {string} textoPlano - El texto a verificar.
 * @param {string} hash - El hash bcrypt almacenado.
 * @returns {Promise<boolean>} true si coincide.
 */
export async function verificarBcrypt(textoPlano, hash) {
  return bcrypt.compare(textoPlano, hash);
}

/**
 * Ofusca un correo electrónico para que no sea visible en los payloads.
 * Ejemplo: "usuario@gmail.com" → "us****o@g***l.com"
 * @param {string} email - El correo electrónico.
 * @returns {string} Correo ofuscado.
 */
export function ofuscarEmail(email) {
  if (!email || typeof email !== 'string') return '***';
  const [local, dominio] = email.split('@');
  if (!dominio) return '***';
  const localOfuscado = local.length <= 2
    ? local[0] + '***'
    : local[0] + '****' + local[local.length - 1];
  const partesDomin = dominio.split('.');
  const dominioOfuscado = partesDomin.map((parte, i) => {
    if (i === partesDomin.length - 1) return parte; // Mantener .com, .co, etc.
    return parte.length <= 2 ? parte[0] + '*' : parte[0] + '***' + parte[parte.length - 1];
  }).join('.');
  return `${localOfuscado}@${dominioOfuscado}`;
}

/**
 * Ofusca una API Key para que no sea legible en los payloads.
 * Ejemplo: "AIzaSyC9Tkyz8gFi..." → "AIza****...TFY"
 * @param {string} apiKey - La API key a ofuscar.
 * @returns {string} API key ofuscada.
 */
export function ofuscarApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return '***';
  if (apiKey.length <= 8) return apiKey.slice(0, 2) + '****';
  return apiKey.slice(0, 4) + '****...' + apiKey.slice(-3);
}
