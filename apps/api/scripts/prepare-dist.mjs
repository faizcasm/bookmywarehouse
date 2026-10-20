// Post-build step for the Vercel serverless function.
//
// The bundled dist/app.js is ESM (the whole repo is "type": "module"), but the
// function bundle that @vercel/node assembles puts dist/* at its root WITHOUT
// carrying apps/api/package.json along. Without a package.json declaring
// "type": "module" next to app.js, Node loads it as CommonJS and dies with
// "Cannot use import statement outside a module". Writing a minimal
// {"type":"module"} package.json into dist ensures it ships next to the
// entrypoint and the function runs as ESM.
//
// It also copies swagger-ui-dist's static assets (css/js/png) into dist/.
// swagger-ui-express serves them via express.static(<swagger-ui-dist dir>),
// and because esbuild inlines that package's __dirname to the bundle's own
// directory, the middleware ends up serving dist/ itself — so the assets must
// physically sit next to app.js for /api/v1/docs to render.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(apiRoot, 'dist');
const pkg = JSON.parse(readFileSync(join(apiRoot, 'package.json'), 'utf8'));
writeFileSync(join(distDir, 'package.json'), `${JSON.stringify({ type: pkg.type }, null, 2)}\n`);

// swagger-ui-dist is a transitive dependency (via swagger-ui-express), so
// resolve it exactly the way swagger-ui-express does at runtime.
const requireFromApi = createRequire(join(apiRoot, 'package.json'));
const requireFromSwagger = createRequire(requireFromApi.resolve('swagger-ui-express'));
const swaggerDistDir = dirname(requireFromSwagger.resolve('swagger-ui-dist/absolute-path'));
mkdirSync(distDir, { recursive: true });
let copied = 0;
for (const file of [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'oauth2-redirect.html',
  'favicon-32x32.png',
  'favicon-16x16.png',
]) {
  const from = join(swaggerDistDir, file);
  if (existsSync(from)) {
    copyFileSync(from, join(distDir, file));
    copied += 1;
  }
}

console.log(`prepare-dist: wrote dist/package.json, copied ${copied} swagger-ui assets`);
