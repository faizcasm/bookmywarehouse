# Deployment — Vercel Free Tier

Design for hosting BookMyWarehouse on Vercel's free ("Hobby") plan for a personal /
non-commercial development setup. Review current Vercel plan limits before deploying —
free tiers change quotas, and the Hobby plan prohibits commercial use.

## Topology — one Vercel project, four services

The repo deploys as a **single Vercel project using [services](https://vercel.com/docs/services)**
(configured in the root `vercel.json`). Each app is an independently built service on one
shared domain:

| Service | Root | Public path | Notes |
| --- | --- | --- | --- |
| `customer` | `apps/customer` | `/(.*)` (catch-all) | Vite static SPA at the domain root |
| `partner` | `apps/partner` | `/partner`, `/partner/(.*)` | Vite SPA; built with `base: /partner/`, router basename `/partner`; build nests output under `dist/partner/` because static lookup uses the original request path (`request.path` transforms only affect function code, not static files) |
| `admin` | `apps/admin` | `/admin`, `/admin/(.*)` | Same scheme with `/admin` (`dist/admin/`) |
| `api` | `apps/api` | `/api/(.*)` and `/health` | Express on the Node runtime, entry `dist/app.js` (esbuild ESM bundle; the default export of `app.ts` is a `(req, res)` request listener, no `listen()`) |

- Rewrites are ordered most-specific first: `/api/*` and `/health` → `api`, then the
  `/partner` and `/admin` prefixes, then the catch-all → `customer`.
- Vite builds key off the `VERCEL` env var: prefixed `base` only on Vercel, `/` locally,
  so `pnpm dev` and the Playwright E2E suite (which use the apps at their own ports)
  are unchanged.
- The frontends reach the API same-origin at `/api/v1` in production builds
  (`VITE_API_URL` overrides), which makes the httpOnly refresh cookie work without any
  cross-site configuration.
- **No service bindings are used**: nothing calls another service server-side. The SPAs
  call the API from the browser over the public `/api/v1` route; the API never calls a
  frontend. (A binding would only be needed if, e.g., the API rendered pages
  server-side or called an internal service.)
- `vercel dev` runs all four services locally with the same routing.

### Serverless constraints and how they're handled

- **No long-lived process** — the API distinguishes `app.ts` (Express app factory +
  serverless default export) from `server.ts` (the local listener), so the platform gets
  a `(req, res)` listener without a socket.
- **Single-file function bundle** — `dist/app.js` is produced by esbuild
  (`--bundle --format=esm`, with a `createRequire`/`__dirname` banner). Vercel stages
  `dist/*` at the lambda root while pnpm's symlinked packages keep repo-relative paths,
  so bare-specifier resolution into `node_modules` fails there; bundling removes the
  dependency entirely. The build also writes `dist/package.json` (`{"type":"module"}`,
  without which Node loads the ESM bundle as CommonJS) and copies swagger-ui's static
  assets next to the bundle, because `swagger-ui-express` serves them from its inlined
  `__dirname`.
- **No in-memory state** — sessions are stateless JWTs; refresh sessions live in MongoDB;
  nothing critical is kept in process memory. Horizontal scaling is safe.
- **No WebSocket/background workers** — the design doesn't rely on any. Email delivery is
  best-effort inline with the request (and `EMAIL_PROVIDER=none` just logs).
- **DB connections** — Mongoose connection is cached across warm invocations
  (`globalThis` cache pattern); Atlas connection pooling absorbs cold starts.
- **No filesystem persistence** — uploaded images go through the uploads service; in
  production configure Cloudinary (`CLOUDINARY_*`) rather than the inline dev storage,
  because serverless filesystem is ephemeral and read-only outside `/tmp`.
- **Execution time** — keep request handlers I/O-bound; no long computations. Pagination
  keeps list queries cheap. If payload-size or duration limits bite, the fallback is a
  single small VPS/Render free web service running `pnpm --filter @bmw/api start` —
  documented as the simplest alternative rather than forcing unsupported infrastructure.

## Environment variables (set in the Vercel project dashboard, not in Git)

Services share one project-level environment scope, so one set of variables feeds all four:

`MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `SESSION_SECRET`,
`API_BASE_URL`, `CUSTOMER_APP_URL`, `PARTNER_APP_URL`, `ADMIN_APP_URL`, `CORS_ORIGINS`,
`EMAIL_PROVIDER`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`, `PAYMENT_PROVIDER`,
`PAYMENT_PUBLIC_KEY`, `PAYMENT_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET`, `LOG_LEVEL=info`,
`TRUST_PROXY=1`, `NODE_ENV=production`.

The frontends need no API variable by default: production builds call same-origin
`/api/v1`. Set `VITE_API_URL` only if the API is ever hosted on a different origin.
`VITE_CUSTOMER_APP_URL` / `VITE_PARTNER_APP_URL` likewise override the cross-app links
(same-origin `/` and `/partner` by default on Vercel).

Secrets are generated per environment (e.g. `openssl rand -base64 32`) and never committed;
`.env` is gitignored, `.env.example` contains placeholders only.

## CORS & cookies in production

- With the single-domain services deployment, all three SPAs and the API share **one
  origin**, so browser requests are same-origin: no CORS preflight occurs and the
  `httpOnly`, `SameSite=Lax`, `Secure` refresh cookie (scoped to `/api/v1/auth`) works
  unchanged. No `SameSite=None` relaxation is needed.
- `CORS_ORIGINS` only matters if you later split the frontends onto different origins;
  keep it set to the deployed origin as a safety net (unknown origins get a permissive
  CORS header + credential rejection).
- `TRUST_PROXY=1` so Express sees the original client IP behind Vercel's proxy (rate
  limiting and audit logs depend on it).

## Webhooks

- `POST /api/v1/payments/webhook` is unauthenticated by design; it verifies the provider
  signature against `PAYMENT_WEBHOOK_SECRET` and is **idempotent by event id** (duplicate
  deliveries are accepted with 200 and ignored).
- Register the production webhook URL with the payment provider after each environment
  change.

## Health check & monitoring

- `GET /health` returns 200 only when MongoDB responds — use it as the uptime probe.
- Structured JSON logs with request ids go to stdout → surfaced in Vercel's function logs.
- Set up a free external ping (e.g. cron-job.org) against `/health`.

## Deployment steps

1. Push the repo to GitHub; in Vercel create **one** project linked to it. Vercel
   auto-detects the root `vercel.json` `services` configuration — no per-service project
   setup is needed.
2. Add the environment variables listed above to the project (Production + Preview).
3. Deploy. The single deployment domain serves all four apps (see the routing table);
   attach a custom domain if desired, and point DNS per Vercel's instructions.
4. Run `pnpm seed` and `pnpm db:indexes` **once** against the production Atlas database from
   a trusted machine (`MONGODB_URI` = production URI), never from CI logs.
6. Verify: `/health`, register/login on each app, a full booking round-trip, and a sandbox
   payment.

## Rollback guidance

- Every deploy is tied to a Git commit — Vercel's dashboard lists past deployments; use
  **Instant Rollback** on any previous production deployment (re-points the domain, no
  rebuild needed).
- Schema changes must stay backward-compatible for at least one release (add fields before
  reading them; migrate lazily) so an app rollback doesn't break on the new DB shape.
- Before risky releases, snapshot Atlas (continuous backup / on-demand snapshot) — restoring
  a cluster snapshot is the DB rollback path.
- Keep the previous known-good commit tagged (e.g. `git tag prod-YYYYMMDD`).

## Free-tier limitations to be aware of

- **Function duration caps** (Hobby: ~10 s–60 s depending on runtime) — fine for this app's
  I/O-bound endpoints; long exports/batch jobs must move off Vercel.
- **Cold starts** on the first request after idle — mitigated by keeping the client-side API
  timeout generous and showing loading states (already implemented in the frontends).
- **Function image size / dependency limits** — pnpm workspace builds are small, but avoid
  heavy native deps.
- **Atlas free tier (M0)**: 512 MB storage, shared RAM — adequate for demo traffic; index
  counts are limited, so keep the 25-model index footprint in mind.
- **Hobby plan = non-commercial only** — a real marketplace launch requires a paid plan.
