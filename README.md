# BookMyWarehouse

A full-stack MERN marketplace where **customers** rent warehouses, storage yards, and industrial
space from **partners**, and **admins** moderate the platform.

> **Status: development build.** All data created by `pnpm seed` is explicitly marked
> demo data (names carry "(Demo)", listing descriptions are prefixed `[DEMO]`).
> The sandbox payment provider performs no real money movement.

## What's inside

| App | Port | Description |
| --- | --- | --- |
| `apps/api` (`@bmw/api`) | 4000 | Express 4 + Mongoose REST API, base path `/api/v1` |
| `apps/customer` (`@bmw/customer`) | 5173 | Customer storefront: search, listings, bookings, payments, reviews, messages |
| `apps/partner` (`@bmw/partner`) | 5174 | Partner workspace: onboarding, listings, availability, requests, earnings, payouts |
| `apps/admin` (`@bmw/admin`) | 5175 | Admin console: dashboard, users, partner verification, listing moderation, disputes, payments |

Shared packages:

- `packages/shared-types` (`@bmw/shared-types`) — DTO types, enums, role/status constants, booking state machine.
- `packages/validation` (`@bmw/validation`) — Zod v4 schemas shared between API and frontends.

## Prerequisites

- **Node.js ≥ 20** (developed on v26)
- **pnpm ≥ 9** (developed on 10.x) — `corepack enable` or `npm i -g pnpm`
- A MongoDB database (e.g. [MongoDB Atlas](https://www.mongodb.com/atlas) free tier)

## Setup

```bash
pnpm install                 # installs the whole workspace

cp .env.example .env         # then edit — see below
```

`.env` values that matter:

| Variable | Notes |
| --- | --- |
| `MONGODB_URI` | **Required.** Connection string; include the DB name, e.g. `.../bookmywarehouse_dev` |
| `PORT` | API port, default `4000` |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` / `SESSION_SECRET` | Any ≥32-char random strings for dev; **must** be set to strong values in production |
| `EMAIL_PROVIDER` | `none` (default) logs emails to the console; `resend` for real delivery |
| `PAYMENT_PROVIDER` | `SANDBOX` (default, no keys needed); `RAZORPAY`/`STRIPE` require keys |
| `*_APP_URL` / `CORS_ORIGINS` | Frontend origins for CORS and email links |

The API loads `.env` from the repo root regardless of the directory you run it from.

## Seed demo data

```bash
pnpm seed          # idempotent — safe to re-run; resets seeded demo records
pnpm db:indexes    # ensure indexes for all collections
```

Demo users (password for all: **`Demo@1234`**):

| Role | Email |
| --- | --- |
| Admin | `admin@bookmywarehouse.dev` |
| Partner | `partner@bookmywarehouse.dev` |
| Partner 2 | `partner2@bookmywarehouse.dev` |
| Customer | `customer@bookmywarehouse.dev` |

The seed also creates categories, published listings (with images), availability rules,
bookings in several states, a published review, and a demo conversation.

## Run it

```bash
pnpm dev          # API :4000 + all three frontends (:5173/:5174/:5175) in parallel
```

Or individually:

```bash
pnpm --filter @bmw/api dev
pnpm --filter @bmw/customer dev
pnpm --filter @bmw/partner dev
pnpm --filter @bmw/admin dev
```

Open http://localhost:5173 (customer), :5174 (partner), :5175 (admin).

## Test, lint, build

```bash
pnpm typecheck    # tsc --noEmit in every package
pnpm lint         # eslint in every package
pnpm test         # unit + integration tests (vitest + supertest; API tests use the MONGODB_URI test DB)
pnpm test:e2e     # Playwright end-to-end suite (starts API + frontends)
pnpm build        # production builds for every package
```

API integration tests run against the database in `MONGODB_URI` with the test suffix
(`bookmywarehouse_test` by default) — they clean up after themselves, but don't point
them at a database you care about.

## API documentation

- Interactive Swagger UI: **http://localhost:4000/api/v1/docs**
- Raw OpenAPI 3.0 JSON: **http://localhost:4000/api/v1/openapi.json**
- Human-readable reference (written for frontend integration): [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)
- Health check: `GET http://localhost:4000/health` (verifies DB connectivity)

### Conventions

- Base path `/api/v1`; JSON only.
- Success envelope: `{ "success": true, "data": ... , "meta": ... }`.
- Error envelope: `{ "success": false, "error": { "code", "message", "details"? } }`.
- Money is stored and returned as **integer minor units** (paise) with an explicit `currency`.
- Auth: short-lived access token (in memory) + rotating **httpOnly** refresh cookie
  (`bmw_rt`, scoped to `/api/v1/auth`). Non-GET requests require the double-submit CSRF
  header `X-CSRF-Token` matching the `bmw_csrf` cookie.
- Passwords are hashed with Node's `scrypt` (salted, timing-safe compare).

## Project layout

```
apps/
  api/         Express + Mongoose REST API (models, services, controllers, routes, seed, tests)
  customer/    Vite + React 18 + TS storefront
  partner/     Vite + React 18 + TS partner workspace
  admin/       Vite + React 18 + TS admin console
packages/
  shared-types/  DTO types, enums, booking state machine
  validation/    Zod schemas shared by API and frontends
docs/
  API_REFERENCE.md   Full endpoint contract
  PROGRESS.md        Build progress log
  DEPLOYMENT.md      Vercel free-tier deployment design
```

## Deployment (Vercel free tier)

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full design: one Vercel project with four [services](https://vercel.com/docs/services)
(three static frontends + one Node API serverless function), Atlas connection reuse,
environment variables, CORS/cookie configuration, webhook security, and rollback guidance.

## Security notes

- `.env` is gitignored — never commit secrets. `.env.example` carries placeholders only.
- Refresh tokens are hashed at rest, rotated on use, and revocable per session
  (`revokeAllSessions` runs on password change / admin suspend).
- Role-based authorization is enforced in API middleware (`requireAuth`, `requireRole`)
  on every protected route — the frontends' UI gating is a convenience, not the boundary.
- Webhook endpoints are unauthenticated by design but verify a signature against
  `PAYMENT_WEBHOOK_SECRET` and are idempotent by event id.
