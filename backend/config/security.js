
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashearConBcrypt(textoPlano) {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(textoPlano, salt);
}

export async function verificarBcrypt(textoPlano, hash) {
  return bcrypt.compare(textoPlano, hash);
}

export function ofuscarEmail(email) {
  if (!email || typeof email !== 'string') return '***';
  const [local, dominio] = email.split('@');
  if (!dominio) return '***';
  const localOfuscado = local.length <= 2
    ? local[0] + '***'
    : local[0] + '****' + local[local.length - 1];
  const partesDomin = dominio.split('.');
  const dominioOfuscado = partesDomin.map((parte, i) => {
    if (i === partesDomin.length - 1) return parte; 
    return parte.length <= 2 ? parte[0] + '*' : parte[0] + '***' + parte[parte.length - 1];
  }).join('.');
  return `${localOfuscado}@${dominioOfuscado}`;
}

export function ofuscarApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return '***';
  if (apiKey.length <= 8) return apiKey.slice(0, 2) + '****';
  return apiKey.slice(0, 4) + '****...' + apiKey.slice(-3);
}
