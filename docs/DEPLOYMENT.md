# Deployment — Vercel Free Tier

Design for hosting BookMyWarehouse on Vercel's free ("Hobby") plan for a personal /
non-commercial development setup. Review current Vercel plan limits before deploying —
free tiers change quotas, and the Hobby plan prohibits commercial use.

## Topology

Four Vercel projects from one monorepo:

| Project | Root directory | Build command | Output |
| --- | --- | --- | --- |
| `bmw-customer` | `apps/customer` | `pnpm install --frozen-lockfile && pnpm --filter @bmw/shared-types --filter @bmw/validation build && pnpm --filter @bmw/customer build` | `apps/customer/dist` (static) |
| `bmw-partner` | `apps/partner` | same pattern with `@bmw/partner` | `apps/partner/dist` (static) |
| `bmw-admin` | `apps/admin` | same pattern with `@bmw/admin` | `apps/admin/dist` (static) |
| `bmw-api` | `apps/api` | `pnpm install --frozen-lockfile && pnpm --filter @bmw/shared-types --filter @bmw/validation build && pnpm --filter @bmw/api build` | Node serverless function |

- Frontends are pure static SPAs → Vercel serves them from the CDN; no server needed.
- The API uses Vercel's **Node.js runtime** with `api/index.ts` → `api/index.ts` exports the
  Express `app` (Vercel's Node builder wraps it). To add: a thin `apps/api/api/index.ts`
  that does `export default app` after importing `../src/app.js`, plus a `vercel.json`
  in `apps/api` routing `/api/(.*)` to it. This has not been wired in the repo yet —
  locally the API runs the long-lived `node dist/server.js` process.

Suggested domains (subject to availability — do not assume these are owned):
`bookmywarehouse.com`, `partner.bookmywarehouse.com`, `admin.bookmywarehouse.com`,
`api.bookmywarehouse.com`. Any `*.vercel.app` domain works for development.

## Serverless constraints and how they're handled

- **No long-lived process** — the API already distinguishes `app.ts` (Express app factory)
  from `server.ts` (the local listener), so a serverless entry can export the app without a
  socket listener.
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

## Environment variables (set in each Vercel project's dashboard, not in Git)

API project: `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `SESSION_SECRET`,
`API_BASE_URL`, `CUSTOMER_APP_URL`, `PARTNER_APP_URL`, `ADMIN_APP_URL`, `CORS_ORIGINS`,
`EMAIL_PROVIDER`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`, `PAYMENT_PROVIDER`,
`PAYMENT_PUBLIC_KEY`, `PAYMENT_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET`, `LOG_LEVEL=info`,
`TRUST_PROXY=1`, `NODE_ENV=production`.

Frontend projects: `VITE_API_URL` (e.g. `https://api.bookmywarehouse.com/api/v1`).

Secrets are generated per environment (e.g. `openssl rand -base64 32`) and never committed;
`.env` is gitignored, `.env.example` contains placeholders only.

## CORS & cookies in production

- `CORS_ORIGINS` must list exactly the three deployed frontend origins — the API reads it
  as a comma-separated allowlist.
- The refresh cookie is `httpOnly`, `SameSite=Lax`, `Secure` in production, and scoped to
  `/api/v1/auth`; therefore the API must be served from a **same-site** parent domain as the
  frontends (the `*.bookmywarehouse.com` scheme) OR the cookie policy must be relaxed to
  `SameSite=None; Secure` for cross-site `*.vercel.app` hosting. The same-site domain
  arrangement is strongly preferred.
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

1. Push the repo to GitHub and import the four projects into Vercel.
2. Set each project's root directory + build command (table above); set the API framework
   preset to "Other" with the Node runtime.
3. Add the environment variables per project.
4. Attach custom domains (or use `*.vercel.app`), and point DNS per Vercel's instructions.
5. Run `pnpm seed` and `pnpm db:indexes` **once** against the production Atlas database from
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
