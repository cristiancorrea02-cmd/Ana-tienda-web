const registros = new Map();
const VENTANA_MS = 60 * 1000;

setInterval(() => {
  const ahora = Date.now();
  for (const [clave, datos] of registros.entries()) {
    if (ahora - datos.inicio > VENTANA_MS) {
      registros.delete(clave);
    }
  }
}, 30 * 1000).unref();

export function verificarLimite(ip, tipo = 'general') {
  const ahora = Date.now();
  const limite = tipo === 'estricto' ? 10 : 120;
  const clave = `${tipo}:${ip || 'desconocido'}`;

  const registro = registros.get(clave);
  if (!registro || ahora - registro.inicio > VENTANA_MS) {
    registros.set(clave, { inicio: ahora, conteo: 1 });
    return { permitido: true, restantes: limite - 1 };
  }

  if (registro.conteo >= limite) {
    return { permitido: false, restantes: 0, reintentarEn: Math.ceil((VENTANA_MS - (ahora - registro.inicio)) / 1000) };
  }

  registro.conteo += 1;
  return { permitido: true, restantes: limite - registro.conteo };
}
