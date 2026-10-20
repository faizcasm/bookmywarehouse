// Vercel services entrypoint — this file must exist in the git tree.
//
// Vercel resolves a service's `entrypoint` against the SOURCE tree during
// service detection, which runs BEFORE `buildCommand`. Pointing `entrypoint`
// straight at build output (dist/app.js) therefore only works when the local
// dist/ happens to be uploaded with the deploy — clean Git clones fail with
// [ENTRYPOINT_NOT_FOUND]. This wrapper is the committed source entry; it
// re-exports the bundled handler that `pnpm --filter @bmw/api build`
// (esbuild src/app.ts → dist/app.js) produces during the Vercel build.
//
// Node resolves dist/app.js as ESM via the dist/package.json {"type":"module"}
// that scripts/prepare-dist.mjs writes, which also copies the swagger-ui
// assets next to the bundle.
export { default } from './dist/app.js';
