# Progress

Living log of the BookMyWarehouse build. All claims below are backed by commands actually
executed in this repository.

## Phase 1 — Workspace scaffolding ✅

- pnpm monorepo: `apps/{api,customer,partner,admin}`, `packages/{shared-types,validation}`.
- TypeScript strict base config, per-package `typecheck`/`test`/`build` scripts.
- `.env` / `.env.example` (root-anchored env loading in the API).

## Phase 2 — Shared packages ✅

- `@bmw/shared-types`: DTO types, enums, booking state machine (`BOOKING_TRANSITIONS`,
  `canTransition`). Builds clean.
- `@bmw/validation`: Zod v4 schemas for auth, listings, bookings, payments, reviews,
  availability, admin. Builds clean.

## Phase 3 — API ✅ (73/73 tests green)

- Config/env, structured logging, error taxonomy, Mongo connection with graceful shutdown.
- Security middleware: helmet, compression, CORS allowlist, cookie parsing, request ids,
  global rate limit + stricter auth limiter, double-submit CSRF (method-aware with
  webhook/GET exemptions), `optionalAuth` + `requireAuth`/`requireRole`.
- All Mongoose models (users, sessions, partner profiles, verifications, categories,
  listings, availability, bookings, payments, refunds, invoices, reviews, conversations,
  messages, notifications, disputes, payouts, audit logs, platform settings, …).
- Services + serializers + controllers + routes for: auth (register/login/refresh/logout,
  rotating refresh sessions, revoke-all), catalog (categories, listing search/detail,
  availability, similar), bookings (quote → request → approve/reject → confirm → complete/
  cancel, state-machine guarded), payments (sandbox intents, webhook with signature check +
  event-id idempotency, invoices, refunds), partner (dashboard, listings CRUD, availability
  rules/exceptions, requests, earnings with real aggregation, payouts, verification
  onboarding), social (reviews with eligibility + response, conversations/messages,
  notifications), admin (dashboard, users, partner verification decisions, listing
  moderation, disputes, payments/refunds, audit logs, platform settings).
- `GET /health` (DB-aware), JSON 404s, global error handler with request-id echo.
- Seed script (idempotent, all records marked demo): 4 users, 4 profiles/verifications,
  4 categories, 4 published listings, availability rule, 3 bookings in different states,
  1 published review, 1 conversation. `pnpm db:indexes` syncs indexes for 25 models.
- **Verification:** `pnpm --filter @bmw/api typecheck` ✅ · `pnpm --filter @bmw/api test` →
  **73 passed / 7 files** (unit: pricing, state transitions, validation · integration:
  auth flows incl. CSRF + role gates, listings & bookings, payments/invoices incl.
  webhook idempotency + access control, review eligibility) against a dedicated
  `bookmywarehouse_test` Atlas database.

## Phase 4 — Frontends ✅ (76/76 tests green across 3 apps)

Built against `docs/API_REFERENCE.md` (written first as the shared contract):

- **Customer (5173)** — 19 pages: home, search, listing detail (gallery, availability,
  quote), booking flow, booking list/detail, checkout + sandbox payment, invoices,
  reviews, messages, notifications, profile. 24/24 vitest tests, `typecheck` ✅, prod
  `build` ✅.
- **Partner (5174)** — 15 pages: onboarding & verification, dashboard (revenue, upcoming,
  requests), listings CRUD + publish, availability rules/exceptions, booking requests
  accept/reject, earnings/payouts, reviews with responses, messages, settings.
  30/30 vitest tests, `typecheck` ✅, prod `build` ✅.
- **Admin (5175)** — 17 pages: dashboard, users, partner verification queue, listing
  moderation (approve/reject), bookings, payments/refunds, disputes, reviews, categories,
  platform settings, audit logs. 22/22 vitest tests, `typecheck` ✅, prod `build` ✅.
- Each app has a handwritten CSS design system (deep-teal `#0f766e` brand), auth context
  with refresh-on-load, CSRF-aware fetch client, route guards per role, loading/error/
  empty states.

## Phase 5 — API polish, docs & lint ✅

- Fixed serialization gaps found in review: admin + partner dashboard `recentBookings`,
  partner `upcomingBookings`/`recentRequests` now go through `renderBooking`; admin
  reviews list now hydrated via `hydrateReviews`; partner earnings `summary` now computed
  from real aggregation instead of zeros.
- OpenAPI 3.0.3 spec + Swagger UI: hand-written spec (`apps/api/src/docs/openapi.ts`,
  ~3.2k lines, typed) covering **all 98 operations** across the 7 route files (86 paths,
  30 component schemas, success/error envelopes, cookie + CSRF + webhook-signature
  security schemes). Served at `/api/v1/docs` (Swagger UI) and `/api/v1/openapi.json`,
  mounted before the rate limiter, no auth required. Verified: both routes 200; scripted
  diff of route files vs. spec = 98/98, 0 missing.
- Repo-wide ESLint added (flat config: `@eslint/js` + `typescript-eslint` recommended,
  `eslint-plugin-react-hooks`, `eslint-plugin-unused-imports` with auto-fix). `pnpm lint`
  runs repo-wide and passes; every finding was fixed properly (no suppression):
  unused imports/vars, dead assignments, ref-during-render in `useAsyncData`
  (moved to an effect), seed initializers.
- README.md ✅, docs/DEPLOYMENT.md (Vercel free-tier design, serverless constraints,
  CORS/cookie/webhook config, rollback guidance) ✅, docs/API_REFERENCE.md ✅.

## Phase 6 — End-to-end tests ✅ (12/12)

- Playwright suite in `apps/e2e` (`pnpm test:e2e`, chromium, workers:1,
  `trace: retain-on-failure`; API + three frontends auto-started via `webServer` with
  `reuseExistingServer`). Covers all 10 required spec scenarios:
  1. Customer registers and searches (UI) + seeded-customer sign-in support test
  2. Customer submits a booking request → PENDING_APPROVAL (UI)
  3. Partner receives and accepts the request (UI)
  4. Booking status reaches CONFIRMED for both sides (UI)
  5. Customer accesses booking details (UI)
  6. Partner submits verification; admin verifies (UI)
  7. Admin approves one listing, rejects another (UI + API setup)
  8. Logged-out redirect from protected pages; customer session blocked from admin
     records (UI + API 401/403)
  9. Overlapping bookings cannot exceed capacity (API invariant, 4xx asserted)
  10. Duplicate payment webhooks create no duplicate financial records (API invariant,
      HMAC signature over exact request bytes, idempotent replay)
- **Product bug found & fixed during E2E:** `HomePage.tsx` treated
  `GET /catalog/categories` as a bare array (API returns `{ items: [...] }`) → blank
  page; fixed by unwrapping `.items`. (Scenario 1 was impossible without this.)
- **Re-runnability hardening (found by running the suite back-to-back):**
  - The in-memory auth rate limiter (20 logins/15 min/IP) tripped `429` on the second
    consecutive run. Limits are now env-configurable
    (`RATE_LIMIT_API_MAX` / `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_AUTH_WINDOW_MIN` /
    `RATE_LIMIT_SENSITIVE_MAX`) with unchanged production defaults; the E2E
    `webServer` entry and local `.env` raise them.
  - Scenario 1 asserted on a generic "warehouse" keyword, but each run leaves more
    approved E2E listings in Pune → the seeded listing drifted off the first page.
    The test now searches the unique phrase "4 loading docks".
  - Scenarios 2–5 booked a deterministic ~60-day window, stacking capacity on every
    run; the window is now jittered per run.
- Verified by execution: `pnpm test:e2e` → **12 passed, twice in a row** (~75 s each);
  `pnpm --filter @bmw/e2e exec tsc --noEmit` ✅.

## Final verification (all executed, not asserted)

| Check | Command | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | ✅ pass |
| Typecheck | `pnpm typecheck` (all 7 packages) | ✅ pass |
| Unit + integration tests | `pnpm test` | ✅ API 73/73 · customer 24/24 · partner 30/30 · admin 22/22 = **149 passed** |
| End-to-end | `pnpm test:e2e` | ✅ 12/12 (re-run verified) |
| Production builds | `pnpm build` | ✅ API tsc build + 3 Vite bundles |
| API docs live | curl `/api/v1/openapi.json`, `/api/v1/docs` | ✅ 200/200, 98 operations |

## Known minor issues (documented, non-blocking)

- Duplicate DOM `id`s on partner `/onboarding`: the shared `AddressFields` component
  (`BusinessForm.tsx`) and the KYC section both render `addr-line1/city/state/postal`.
  E2E scopes selectors to the KYC section; proper fix is an `idPrefix` prop.
- E2E note: Playwright resolves relative request paths against `baseURL` dropping a
  leading slash's `/api/v1` prefix — handled inside the E2E `apiUrl()` helper only.

## Outstanding / next

1. ~~`git init` → initial commit → push~~ — done; see repo history.
2. Post-MVP candidates: Cloudinary image storage for production, real payment provider
   keys (Razorpay/Stripe), email delivery via Resend, `idPrefix` fix for onboarding
   address fields.
