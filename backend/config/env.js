// Carga .env como respaldo local; las variables inyectadas (por ejemplo, desde Infisical) tienen prioridad.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ_PROYECTO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

try {
  process.loadEnvFile(path.join(RAIZ_PROYECTO, '.env'));
} catch {
  // Sin .env (o Node anterior a 20.12): se usan las variables del entorno.
}
