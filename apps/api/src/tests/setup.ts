import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Runs before any test file imports the app.
 * - Loads .env from the closest ancestor (repo root or apps/api).
 * - Forces NODE_ENV=test (disables rate limiting) and LOG_LEVEL=silent.
 * - Points MONGODB_URI at a dedicated test database.
 */
function loadEnvFile(): void {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate });
      return;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  loadDotenv();
}
loadEnvFile();

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

const baseUri = process.env.MONGODB_URI;
if (!baseUri) {
  throw new Error('MONGODB_URI must be set (copy .env.example to .env) to run tests');
}
// Swap the database name for an isolated test database.
process.env.MONGODB_URI = /\/[^/?]*(\?.*)?$/.test(baseUri)
  ? baseUri.replace(/\/[^/?]*(\?.*)?$/, '/bookmywarehouse_test$1')
  : `${baseUri}/bookmywarehouse_test`;
