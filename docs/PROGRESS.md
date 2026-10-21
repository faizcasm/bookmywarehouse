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
| Unit + integration tests | `pnpm test` | ✅ API 73/73 · customer 26/26 · partner 30/30 · admin 22/22 = **151 passed** |
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
2. **Vercel multi-service deploy config** — done: root `vercel.json` deploys the repo as
   one Vercel project with four services (`customer` @ `/`, `partner` @ `/partner`,
   `admin` @ `/admin`, `api` @ `/api/*` + `/health`). Added `apps/api/src/serverless.ts`
   (Express app as request listener, `globalThis`-cached Mongo connection), Vite
   `base` + router `basename` for the prefixed apps (keyed off `VERCEL` env so local
   dev/E2E are unchanged), same-origin `/api/v1` API default in production builds, and
   env-driven cross-app links. No service bindings needed — no server-to-server calls
   exist (SPAs call the API from the browser over the public route). Deployment details
   in `docs/DEPLOYMENT.md`.
   **Shipped 2026-10-20** — production live at <https://bookmywarehouse.vercel.app>,
   verified end-to-end (health with Atlas connected, openapi + Swagger UI assets, every
   SPA deep link incl. `/partner`/`/admin` prefixes, demo login writing to Atlas from
   Vercel). During rollout the API entry became `dist/app.js`, an esbuild ESM bundle
   with the request listener as `app.ts`'s default export (replaces `serverless.ts`):
   the services builder forces `handler: app.js`, stages `dist/*` flat while pnpm keeps
   repo-relative `node_modules` paths (breaking bare-specifier resolution), and omits a
   root `package.json` (so ESM loaded as CJS). The build now bundles to one
   self-contained file, writes `dist/package.json` (`type: module`), and copies
   swagger-ui's static assets beside it. Also: SPA history fallback is **not**
   automatic in services mode — each SPA service declares `handle: filesystem` +
   → `index.html` explicitly. And `request.path` transforms do NOT affect static
   file lookup (it always uses the original URL path), which had left every
   `/partner/*` and `/admin/*` asset serving fallback HTML (JS/CSS got
   `text/html` → apps never booted). Fixed by physically nesting those builds
   under `dist/<prefix>/` (`scripts/nest-dist.mjs`) with fallbacks rewritten to
   `/<prefix>/index.html`; verified by content-type + a full browser sweep of
   all 98 route visits (auth: 50/50 clean).
3. **Modern SaaS design refresh across all three SPAs** — done: one shared token
   language everywhere (Inter Variable bundled via `@fontsource-variable/inter` —
   admin referenced `Inter` without shipping it; layered slate/teal shadows,
   10/14/20px radii, `--ease-out`/`--dur` motion tokens, gradient brand + focus
   rings), gradient primary buttons with lift/press micro-interactions, glass
   sticky headers/topbars, animated customer hero (floating gradient orbs +
   staggered entrance), card hover lifts with teal border tint, dropdown/modal
   pop-ins, pathname-keyed page-transition wrappers (`App.tsx` / `AppShell.tsx`),
   scroll-reveal home sections (IntersectionObserver in customer `App.tsx`), and
   `prefers-reduced-motion` guards in all three apps. E2E uses only `#id`
   selectors, so restyling was test-safe — verified by lint/typecheck/test
   149/149, E2E 12/12, and local + production screenshots.
   **Shipped 2026-10-20.**
4. **Git → Vercel auto-deploys fixed** — pushes to `main` were failing seconds after each
   manual deploy with `[ENTRYPOINT_NOT_FOUND] Service "api" has entrypoint "dist/app.js"
   but that path does not exist`: Vercel resolves a service's `entrypoint` against the
   *source* tree during service detection, which runs **before** `buildCommand`, so build
   output can never satisfy it on a clean clone (CLI deploys passed only because the
   locally built `dist/` rode along in the upload). Fixed by pointing `entrypoint` at a
   committed wrapper, `apps/api/server.js` (`export { default } from './dist/app.js'`),
   which re-exports the bundled handler — the packaged function is unchanged (handler
   `app.js`, `dist/*` staged flat, ESM marker + swagger assets beside it). Verified with
   a `dist/`-less local `vercel build`, then a real Git-triggered production deploy and
   full production checks; lint/typecheck/test 149/149.
   **Shipped 2026-10-20.**
5. **Premium B2B redesign: shared `@bmw/ui` system, Tailwind v4, light/dark themes,
   Motion, recharts, 3D hero** — done: new source-only workspace package `packages/ui`
   with a single design-token source `tokens.css` (electric-blue `#2563eb` primary, deep
   navy ink, crisp neutrals, teal kept as accent; light on `:root`, dark on
   `[data-theme="dark"]`, mapped through Tailwind v4 `@theme inline` so utilities flip at
   runtime), an `ThemeProvider`/`ThemeToggle` trio (light/dark/system, persisted under
   `bmw-theme`, live system-follow) with a no-FOUC bootstrap script in each `index.html`,
   a shadcn-style kit (Button, Card, Dialog with focus-trap/scroll-lock, Dropdown, Tabs,
   Stat+CountUp, EmptyState/ErrorState, form field primitives, …) and Motion variants +
   `MotionConfig reducedMotion="user"`. All three SPAs now compile Tailwind v4
   (`@tailwindcss/vite`) and their stylesheets were rewritten onto the token layer while
   preserving every E2E/unit-test selector contract (`.badge--*`, `.toast__message`,
   `table.data-table`, `.queue-item`, `#kyc-heading`, `#reason-dialog-input`,
   `role="img"` chart summaries, all `#id`s). Customer got a split hero with a lazy
   React Three Fiber procedural warehouse scene (graceful fallbacks: mobile, reduced
   motion, ≤4 GB deviceMemory, data-saver, no WebGL → CSS visual), lucide icons
   throughout, AnimatePresence page transitions; partner got a recharts revenue/bookings
   combo + animated Stat cards under a glass shell; admin got recharts revenue/trends +
   a KPI grid with its accessible chart contract kept, premium queue and tables.
   jsdom test setups gained `matchMedia`/`IntersectionObserver`/`localStorage` stubs,
   plus new `@bmw/ui` smoke tests.
   **Pre-existing bugs found & fixed during the sweep:** customer
   Favorites/Bookings/Invoices treated the `{items}` API envelope as a raw array
   (a `TypeError` crashed all three pages for every signed-in customer); admin Reviews
   crashed on hydrated review DTOs and POSTed moderation to `undefined` ids; admin
   `formatRelativeTime` passed a `Date` into a string formatter.
   **Verified by execution:** `pnpm lint` ✅, `pnpm typecheck` ✅, `pnpm test` →
   **151/151** (API 73 · customer 26 · partner 30 · admin 22), `pnpm test:e2e` →
   **12/12**, `pnpm build` ✅, dist-less local `vercel build` of all four services ✅,
   Git deploy `dpl_2uspHCmYmagdHVBSx4DuFyzFRhBX` → READY, and a production browser
   sweep of all three SPAs in light **and** dark mode with zero console/page errors
   (demo data, recharts and theme toggle confirmed live).
   **Shipped 2026-10-20.**
6. **Production readiness: real payments, transactional emails, CSV exports, SEO/PWA,
   demo purge + production seed** — done:
   - **Real Razorpay adapter** (orders API, Checkout.js hosted flow, HMAC-verified
     `POST /payments/verify` idempotent, signed webhooks dual-header, refunds pushed
     through refund API; Stripe slot kept behind same adapter interface).
   - **Transactional emails** (Resend env-gated, fire-and-forget in `notify()` with
     curated map: booking requested/accepted/cancelled, payment success/failure,
     refund initiated/completed, dispute opened — never blocks business flow).
   - **Admin CSV exports** (`GET /admin/exports/bookings.csv`, `/payouts.csv` with
     UTF-8 BOM, RFC4180 escaping, audit trail, buttons on Bookings/Payments pages).
   - **SEO/PWA polish** (dynamic sitemap.xml from published listings, robots.txt,
     manifest.webmanifest + icons generated via Playwright, per-page OG/meta via
     `useDocumentMeta`, print-ready invoice with `@media print`).
   - **Demo purge + production seed** (demo content off by default in production,
     `SEED_DEMO=true` to force; admin bootstrap via `SEED_ADMIN_EMAIL/PASSWORD`;
     deterministic category-themed SVG covers in seed + `placeholderCover.ts` for
     customer SPA fallbacks).
   - **Production boot guardrails**: API refuses to boot without auth secrets +
     `PAYMENT_WEBHOOK_SECRET` (prevents predictable dev fallback forgery); loud
     warnings for sandbox payments / log-only email / missing Cloudinary in prod.
   - **Customer auth split-screen** (dark brand panel with value props + glass form
     card, password strength meter, reveal toggles, working "Fill credentials" demo
     callout — removed in production seed mode).
   - **Homepage upgrade**: staggered word-reveal hero, real-category scrolling ticker,
     "Book in three steps" section, partner CTA band linking to `PARTNER_APP_URL`.
   **Verified by execution:** lint/typecheck ✅, `pnpm test` → **177/177** unit
   (API 99 · customer 26 · partner 30 · admin 22), `pnpm test:e2e` → **12/12**,
   `pnpm build` ✅ all four services.
   **Shipped 2026-10-21.**
7. **World-class 2026 frontend redesign: glassmorphism, motion, 3D, responsive** — done:
   - **Shared token layer** (`packages/ui/tokens.css`): glass system (`.glass`,
     `.glass-strong`, `.glass-inset`, `.atmosphere`), atmospheric backdrops,
     refined blur/sheens, typography defaults (tightened display headings, `text-wrap:
     balance/pretty`), all dark/light safe.
   - **Customer marketplace** (all 19 pages): Header a11y (aria-controls, Esc-close,
     focus restore); **ConversationPage** rebuilt (h1, glass bubbles, sticky glass-inset
     composer, entrance stagger, empty state, mobile rules); **SearchPage** staggered
     results + skeleton crossfade, glass filter panel, active-filter chips, mobile
     filter drawer; **ListingPage** entrance motion, gallery polish, sticky
     glass-strong quote panel, availability motion, section rhythm; **all dashboard
     pages** premium scaffold (header reveal → toolbar stagger → content card fadeUp),
     status timeline polish, table staggered row entrances, empty states with icons,
     hover micro-interactions; **responsive tables** stacked ≤640px via `data-label`
     + `td::before` (keeps DOM for E2E); route transitions via `AnimatePresence` +
     `pageTransition`; tokenized hex cleanup; scroll-reveal `.reveal` reuse.
   - **Partner console** (all 15 pages): AppShell hardened (Esc topmost-layer close,
     focus restore, `.glass-strong` dropdowns with popIn exit); **AuthShell** split-screen
     partner variant (dark brand panel + glass form); all pages consistent page-header
     + staggered entrance scaffold; **ListingForm** section grouping, `FormSection`
     wrapper with field-row stagger, sticky actions, upload previews; Onboarding stepper
     motion, KYC status clarity; Earnings charts dark-theme readable; responsive tables
     card/stacked ≤760px (DOM preserved); empty/error/skeleton states unified.
   - **Admin panel** (all 17+ pages): Uniform page scaffold rhythm across 13 B-grade
     pages + detail pages; strategic glass (topbar, toolbars `.glass-inset`,
     modals `.glass-strong`); **ReviewsPage** client-side filter removed → honest
     disabled control; **404 route** inside auth guard (routeGuard test passes);
     **RefundsPage** audit log wrap fix; responsive DataTable `col-secondary` hiding
     ≤1024px, toolbar wrap ≤768px, dialog max-height + stacked footer ≤560px, 360px
     no-overflow verified; Dashboard charts dark-theme polished.
   **Verified by execution:** lint/typecheck ✅, `pnpm test` → **177/177** unit,
   `pnpm test:e2e` → **12/12**, `pnpm build` ✅ all four services.
   **Shipped 2026-10-21.**
8. Post-MVP candidates: Cloudinary image storage for production, real payment provider
   keys (Razorpay/Stripe), email delivery via Resend, `idPrefix` fix for onboarding
   address fields.
