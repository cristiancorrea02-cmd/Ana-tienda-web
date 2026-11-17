
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ_PROYECTO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

try {
  process.loadEnvFile(path.join(RAIZ_PROYECTO, '.env'));
} catch {
  
}
