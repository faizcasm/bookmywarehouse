#!/usr/bin/env node
// Nest a Vite build under its public path prefix inside dist/.
//
// Vercel serves a service's static files by the ORIGINAL request path
// (/partner/assets/x.js → <outputDirectory>/partner/assets/x.js), and
// request.path transforms never affect that lookup. So the prefixed SPAs
// must physically ship as dist/<prefix>/… while outputDirectory stays "dist"
// and the HTML references /<prefix>/assets/… (vite `base`).
//
// Usage: node ../../scripts/nest-dist.mjs partner   (cwd = the app dir)
// Run after `vite build`, which has already emptied dist/.
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const prefix = process.argv[2];
if (!prefix || prefix.includes('/') || prefix.startsWith('.')) {
  console.error('nest-dist: expected a single path segment, e.g. "partner"');
  process.exit(1);
}

const dist = join(process.cwd(), 'dist');
const target = join(dist, prefix);
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

let moved = 0;
for (const entry of readdirSync(dist)) {
  if (entry === prefix) continue;
  renameSync(join(dist, entry), join(target, entry));
  moved += 1;
}
console.log(`nest-dist: moved ${moved} entries into dist/${prefix}/`);
