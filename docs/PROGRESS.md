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
8. **Post-redesign finishing pass: fix broken working tree, dead links, dead CSS** — done:
   The working copy was left in an inconsistent state after the redesign commit; this
   pass restored coherence and closed real defects. Full detail in `docs/PROJECT_AUDIT.md`.
   - **Restored `apps/customer/src/styles.css`** to the coherent BookMyStudio version —
     the working copy had been reverted to a pre-redesign electric-blue file missing the
     `bento-card`/`nav-pill`/`stagger-*`/`hero-*` classes the committed `HomePage.tsx`
     uses (homepage rendered unstyled). Kept the working-copy `tokens.css` fixes.
   - **Dark mode + shared tokens:** kept the fix that re-adds `--bg-grid`/`--glass-strong`
     (referenced by partner/admin styles, undefined at the redesign commit) and switches
     the Tailwind `dark:` variant from a never-applied `.dark` class to `[data-theme='dark']`
     (the attribute the app actually sets).
   - **Homepage invisible-sections bug (critical):** `App.tsx` scroll-reveal adds
     `is-in`, but CSS matched `.reveal.is-visible` → every `.reveal` section stayed at
     `opacity:0`. Renamed 3 rules to `.reveal.is-in`.
   - **Dead CSS:** 5 `.dark .step-badge` rules rewritten to `[data-theme='dark']`; removed
     the committed `styles.css.bak` backup.
   - **Dead routes (404s):** added `TermsPage` (`/terms`) and `PartnerBenefitsPage`
     (`/partner-benefits`) — both were linked from `HomePage` with no route — registered
     them, and linked from the footer (incl. Terms in the footer bottom, laid out via a
     flex `footer-bottom`).
   - **Lint:** removed unused `categoryList` in `HomePage.tsx`. **Theme meta:** aligned
     `applyTheme`'s `<meta name="theme-color">` to the slate palette.
   **Verified by execution:** `pnpm lint` → 0 errors · `pnpm typecheck` → all 8 projects ✅ ·
   `pnpm build` → all four services ✅ · frontend tests **78/78** (customer 26 · partner 30 ·
   admin 22) · API unit tests (pricing/transitions/validation) pass. DB-backed API integration
   tests need Atlas network access, unavailable in this sandbox (`querySrv EBADRESP`); no API
   code was changed this pass.
9. Post-MVP candidates: Cloudinary image storage for production, real payment provider
   keys (Razorpay/Stripe), email delivery via Resend, `idPrefix` fix for onboarding
   address fields.

---

## Phase 9 — Full UI/UX audit & fix (2026-10-22)

**Goal:** Audit every route/page across the three SPAs, fix all frontend bugs and
responsive failures, restore parity with the BookMyStudio reference, and produce
`docs/UI_UX_AUDIT.md`.

### Root-cause finding (critical)

- **Customer stylesheet regression.** The "BookMyStudio-inspired redesign" commit
  (`38b5ceb`) rewrote `apps/customer/src/styles.css` from ~4,200 lines to ~1,940 and
  **silently deleted ~150 component classes** while keeping the responsive/print blocks
  that reference them. Affected: modals, loaders, listing cards, gallery, auth shell,
  chat/conversations, notifications, bookings, payments, invoices, profile, pagination,
  search filters, state blocks, skeletons, spinners, toasts, tabs, timelines, rating
  stars, price tags — plus the base layout grids (`.search-layout`, `.listing-layout`,
  `.detail-layout`, `.profile-layout`, `.listing-hero`, `.filter-sidebar`) whose desktop
  definitions were gone (only mobile media-query stubs remained). It shipped because tests
  select by `#id`/utility classes, not the deleted visual classes.
- **Verified programmatically** by comparing JSX class usage against CSS subject
  selectors across all three apps (customer missing ~150; partner/admin clean — their
  apparent gaps were template-literal false positives like `tone-${x}`).

### Fixes applied

- **Restored customer component styles:** merged the complete pre-redesign component
  sections (recovered via `git show HEAD:…styles.css.bak`) into the redesigned sheet,
  keeping the new BookMyStudio base/header/footer/hero. Old sheet is token-driven
  (482 `var()` refs) so it inherits the current emerald/slate theme automatically.
  Resulting file: ~4,210 lines, braces balanced, single `@media print` block intact.
- **Re-added dropped base utilities:** `.muted`, `.mono`, `.text-danger`,
  `.center-action`, `.card-list`, `.booking-detail-head`, `.head-actions`, and a
  `.btn-primary` alias mirroring `.btn-brand`.
- **Authored 11 classes present in neither version:** `.home-page`, `.search-page`,
  `.listing-page`, `.listing-main`, `.detail-main`, `.footer-links`, `.user-dropdown`,
  `.bell-btn`, `.print-btn`, `.auth-brand-mark`, `.orbit-ring--outer`.
- **Added missing API endpoint `GET /conversations/:id`** (was 404'ing on every
  conversation open, silently degrading the listing title): new `getConversation()` in
  `messaging.service.ts` (membership-checked, returns one `ConversationDTO`),
  `getConversationHandler`, and the route. Additive only; no existing logic touched.
- **Audited, verified non-defects:** `window.open` already passes
  `noopener,noreferrer`; full frontend→API endpoint coverage confirmed once router mount
  prefixes are accounted for (`/conversations/:id` was the only genuine gap).

### Verification by execution

- `pnpm lint` → **0 errors** (2 pre-existing script `no-console` warnings).
- `pnpm typecheck` → all **8 projects ✅**.
- Frontend tests → **customer 26/26 · partner 30/30 · admin 22/22** (78 total, all pass).
- `pnpm build` → all **4 services ✅** (customer CSS now 120.8 kB / 22.3 kB gzip).
- API tests → 44 unit pass; 55 DB-backed integration tests need Atlas network access,
  unavailable in this sandbox (`querySrv EBADRESP`). This is a pre-existing environment
  limitation, **not** a regression — only an additive service/handler/route was changed
  (typechecks clean).

### Docs

- Created `docs/UI_UX_AUDIT.md` (bugs, broken pages, responsive issues, reference
  comparison, functional/perf notes, prioritized checklist — verified vs. assumed).

### Next steps (external / not code defects)

- Razorpay keys + `PAYMENT_WEBHOOK_SECRET`; Resend API key; Cloudinary credentials;
  reachable Atlas + `pnpm db:indexes`.
- Deployed-build visual verification at matched viewports (needs browser access).
- Optional: trim the lazy-split `HeroScene` chunk (~831 kB / 221 kB gzip).

## Phase — fresh code drop (`BookMyWarehouse-Redesigned.zip`) + verification pass ✅

The redesigned archive was imported as the working tree and re-verified from scratch
instead of being trusted, because the previous pass could not run any checks.

### Verification by execution

- `pnpm install --frozen-lockfile` → lockfile up to date, no dependency drift.
- `pnpm lint` → **0 errors** (2 pre-existing `no-console` warnings in build scripts).
- `pnpm typecheck` → all **8 projects ✅**.
- Frontend tests → **customer 26/26 · partner 30/30 · admin 22/22 = 78/78 ✅**.
- API tests → **44 unit tests ✅**; 55 DB-backed integration tests skip because MongoDB
  Atlas is unreachable from this sandbox (`querySrv EBADRESP`) — pre-existing, and no
  API business logic changed in this pass.
- `pnpm build` → all **4 services ✅**.
- **Headless-browser pass (Playwright + Chromium)** — a green build does not prove a
  class has styles, so 34 routes across the three SPAs were loaded at 1366px and 390px:
  no page errors, no thin/unstyled content, no horizontal scroll possible. Class coverage
  was also checked programmatically against the *built* CSS.

### Bugs found by that verification and fixed

1. **`.hero-scene-canvas` had no rule** → the customer hero 3D scene rendered as a 150px
   strip in a 900px card (R3F falls back to intrinsic canvas height) and kept
   `pointer-events: auto` despite being decorative. Now absolute-fill +
   `pointer-events: none` (1126×900 measured).
2. **Custom `.hero-grid { grid-template-columns: 1.4fr 1fr }` beat Tailwind's layered
   `lg:grid-cols-12`** → the markup's `lg:col-span-7` / `lg:col-span-5` spanned phantom
   auto tracks (computed `527px 376px 0 0 0 0 0`), stacking the hero with full-bleed copy
   and the scene pushed to a second row. Removed the duplicate declaration; the hero is
   now two columns (copy 700px / scene 484px).
3. **Partner `AuthShell` brand lockup unstyled** — `.brand`, `.brand-mark`,
   `.auth-brand-mark` and `.orbit-ring--outer` were used in markup but never defined, so
   the "BMW" chip rendered as plain text. Also `.orbit-ring--inner` used
   `rgb(var(--brand) / 0.32)`, invalid once `--brand` substitutes `#10b981`; the
   declaration was dropped and the inner ring became invisible on the dark panel.
   Ported the token-driven rules and switched to `color-mix(in oklab, var(--brand) 32%, transparent)`.

Remaining classes absent from the built CSS were reviewed and confirmed non-defects
(`is-read`, `mobile-open`, `brand-footer`, `revenue-block`, `review-card`, `bell-btn`) —
see `docs/REDESIGN_NOTES.md`.

### Docs

- `docs/REDESIGN_NOTES.md` verification section rewritten: it previously recorded that
  no check could be run; the checks now have been run and their results recorded.

## Phase — responsiveness pass (2026-10-22)

**Goal:** make all three SPAs hold up on phone widths, starting from the reported
footer problem ("an unnecessary e-mail address is breaking the layout") and continuing
into a measured audit of every route at 320 / 375 / 390 / 420 / 768 / 1024 / 1440.

### How it was verified

Two headless-browser audits (Playwright + Chromium against the Vite dev servers):

- **Public routes** — 40 route/viewport combinations.
- **Authenticated routes** — 43 combinations, unlocked by a mock API that answers with
  the real `{ success, data, meta.pagination }` envelopes plus deliberately long names,
  cities and e-mail-shaped strings. A logged-out sweep cannot reach tables, dashboards,
  search grids, chat or invoices, and a bare-array mock renders them empty (which looks
  like "no issues"), so the envelope had to match the real API.

Each page was scanned for content spilling past the right edge, content clipped inside
its own box, horizontally scrollable containers, and touch targets under 32px. A
`pageerror` listener plus a blank-body check makes sure a crashed page can never be
reported as clean.

### What was found and fixed

1. **Footer e-mail removed** (`support@bookmywarehouse.dev`) — the widest string in the
   footer and the reason the Support column wrapped mid-phrase. The column keeps "Raise a
   dispute" and "Messages".
2. **The recurring root cause: `min-width: auto`.** Grid/flex children refuse to shrink
   below min-content and `1fr` is `minmax(auto, 1fr)`, so one long child widened its
   whole row past the viewport — and `body { overflow-x: clip }` then hid the scroll,
   cutting the content off. Measured: hero column 332.8px inside a 276px track at 320px;
   auth shell 384px inside a 320px window; invoice parties 517px at 320px (one
   unbreakable e-mail — needs `overflow-wrap: anywhere`, because `break-word` does not
   reduce intrinsic size); admin booking detail 1127px inside a 1024px window. All fixed
   with `min-width: 0` / `minmax(0, 1fr)`.
3. **Headers stopped fitting at ≤375px** — menu button at `right=390px`, user pill at
   `right=340px`. First name dropped below 480px, wordmark scaled so it is whole from
   375px up (compact "BMW" mark below that), and partner/admin page titles wrap to two
   lines instead of ellipsising to 71–93px.
4. **Touch targets** — footer links 29px, password-reveal toggle 27×27 and standalone
   action links 16–25px, all now ≥34px. In-sentence links left alone (WCAG 2.5.8
   "inline" exception).
5. **Smaller corrections** — footer stuck in two columns on phones because the
   `max-width: 1020px` rule appears later in the file than the `560px` one and wins by
   source order; profile `<input type="file">` intrinsic width (~335px) pushing its
   wrapper off-screen; admin reviews filter select overflowing at 320px (label
   shortened, `.select--sm` capped); register role-card label sliding under its check
   badge at tablet width.

### Verification by execution

- `pnpm lint` → 0 errors · `pnpm typecheck` → 8/8 projects.
- `pnpm test` → **177/177** (customer 26, partner 30, admin 22, API 99). The MongoDB
  Atlas DNS issue that had blocked 55 integration tests cleared, so they run now too.
- `pnpm build` → 4/4 services.
- Final audit: no content clipped at the right edge on any route or viewport; the only
  remaining off-screen children are inside horizontal scroll containers (tab strips,
  `.table-wrap` data tables, hero type tabs), which is by design.

### Docs

- `docs/REDESIGN_NOTES.md` — new "Third pass — responsiveness" section with the measured
  table of overflow findings, and the verification block updated to the current results.

## Phase — production readiness pass (2026-10-22)

**Goal:** "menu bar and theme icon should be at right end … check more details and bugs
errors fix them and make this ready for production, treat it as a real product project
not just dummy."

### How it was verified

Two independent audits, run before touching anything — an API security/operations review
(read `app.ts`, `env.ts`, auth/payment/rate-limit/export paths, every model vs. every
service query) and a frontend hygiene review (every `src/**/*.tsx` for console leftovers,
dead links, alt/label coverage, `index.html` head tags, route catch-alls, error
boundaries). Only findings verified in the source were fixed; audit assumptions that did
not hold were discarded. Header changes were then measured in Chromium element-by-element
at 1280/768/420/375/320 with a real logged-in session.

### Header control order (reported)

`ThemeToggle` was the *first* child of each actions cluster, so it rendered mid-header
while the menu button sat at the right edge. It is now the last child in all three apps:
customer `bell → account → menu → theme`, partner `bell → account → theme`, admin
`bell → sep → account → theme`. Measured: theme is the right-most element at every
viewport, nothing exceeds the viewport.

### Security (API)

1. **Payment forgery (critical).** `/payments/simulate` let any authenticated user flip
   *any* payment to `SUCCEEDED` — booking → `CONFIRMED` + invoice, for free. Now checks
   the payment's booking belongs to the caller and refuses in production. Regression
   test: stranger → 403, payment stays `PENDING`, owner still succeeds.
2. **Spoofable rate limits.** `trust proxy` was hardcoded `true`, so client-supplied
   `X-Forwarded-For` fed the auth lockout and audit IPs. Now follows `TRUST_PROXY`.
3. **Revoked sessions stayed valid ≤15 min** — `payload.sid` was read but never checked.
   Now validated against `RefreshToken` (one `_id` lookup) on every request.
4. **Dev secrets could reach production** if `NODE_ENV` was wrong: the loader silently
   substituted published `dev-insecure-…` placeholders. Now refuses to boot on a
   deployment platform and rejects placeholders in production.
5. **`sensitiveLimiter` was dead code** (defined, never attached) → wired to
   change-password, user moderation, refunds, disputes, settings and CSV exports.
6. **CSV formula injection** — exports carry partner-authored titles; `csvField` now
   neutralises `= + - @` (4 assertions added).
7. Refresh cookie `maxAge` ignored `REFRESH_TOKEN_TTL_DAYS`; `/health` disclosed email
   provider config to unauthenticated probes. Both fixed.

### Operations (API)

8. **Indexes were never built in production** (`autoIndex:false`, no deploy step runs
   `db:indexes`) → one non-blocking `syncIndexes()` pass per process at connect,
   failures logged and never fatal.
9. **No access logging** → completion logger on `res.finish` (method/path/status/
   duration/requestId/userId), levelled by status, skipping health/docs probes.
10. Partner booking lists sorted in memory — added the missing `{partner,status,createdAt}` index.
11. Upload size cap ran before the Cloudinary branch, contradicting its own error message.

### Frontend

12. **No error boundary in any app (critical)** — any render exception or failed lazy
    chunk white-screened all three SPAs. Added `ErrorBoundary` (+ `lazyWithRetry` for the
    customer's 3D hero) in each app.
13. partner/admin had **no favicon, no icons, no description, no OG tags**; customer
    declared `summary_large_image` with no image anywhere; admin preconnected to Google
    Fonts it never loads. All corrected (relative icon paths so they work at `/` in dev
    and `/partner/`, `/admin/` on Vercel).
14. partner silently redirected unknown URLs to the dashboard (no 404) → NotFound page
    inside the authenticated shell, matching the other two apps.
15. Duplicate DOM id `city-suggestions` (desktop sidebar + mobile drawer coexist);
    partner/admin never updated `document.title`; 5× `rel="noreferrer"` without
    `noopener`; listing cover images with empty `alt`; two React Router v7 deprecation
    warnings on every load; 2 of 8 `exhaustive-deps` suppressions removed where provably
    safe (the other 6 kept with a written reason — each would loop or change behaviour).

### Verification by execution

- `pnpm lint` → 0 errors · `pnpm typecheck` → 8/8.
- `pnpm test` → **180/180** (customer 26, partner 30, admin 22, API 102 — was 177 before,
  the 3 new ones are the payment-forgery and CSV-injection regression tests).
- `pnpm build` → 4/4 services.
- Chromium: header order measured across 5 viewports with a real session; partner/admin
  meta + icon fetch verified; all three apps render with 0 page errors; per-route
  `document.title` confirmed.

### Docs

- `docs/REDESIGN_NOTES.md` — new "Fourth pass — production readiness" section, 20 numbered
  findings; verification block updated to 180/180.

## Phase — design consistency pass (2026-10-22)

**Goal:** "still not aligned design … think and research and make it the best production
ready platform end to end."

### How it was verified

A design-QA sweep ran first, before changing anything: an admin account was promoted
directly in the database (registration correctly rejects `ADMIN`), then 18 screenshots were
captured across all three SPAs at 1440px and 390px, logged in and out, and reviewed. Every
finding below was reproduced in the browser and re-measured after the fix.

### What was found and fixed

1. **`/search` rendered no listing cards on a hard load (critical).** "66 listings found"
   above an empty grid. Direct load/refresh reproduced it every time; SPA navigation never
   did. The results grid wrapped cards in `<AnimatePresence mode="popLayout">`, and its
   late-mounted children never resolved the inherited `show` variant — every card stayed
   pinned at `opacity: 0`. Removed the wrapper to match every other list in the app.
2. **Statuses coloured differently per console.** A `CONFIRMED` booking was green in
   customer/partner but blue in admin. Aligned admin's booking tones to the tested
   partner/customer values, aligned customer's `CANCELLED` to neutral, and locked all eleven
   booking tones in a contract test.
3. **Role badges visually identical.** `--info` and `--accent` are the same blue, so
   `CUSTOMER` and `PARTNER` matched. Gave each role a distinct hue, made `UsersPage` read
   the shared map instead of an inline ternary, and asserted the three differ.
4. **Dashboard chart colours swapped** vs. the partner console. Revenue line is now brand
   green, bookings bars accent blue, with tooltips and hover cursors threaded through.
5. **Hero alignment (the reported issue).** Widened the headline's `max-width` and added
   `text-wrap: balance` (three even lines instead of stranded words); stretched the scene
   column so both columns end flush; added `ResponsiveCamera` to dolly back by
   `designAspect / aspect` so the taller frame no longer crops the 3D warehouse.
6. **Login and profile polish.** Admin login gained the heading/lead the other two logins
   have; the profile avatar's raw "Choose File" input became a labelled button that keeps
   the native input focusable.

### Verification by execution

- `pnpm lint` → 0 errors · `pnpm typecheck` → 8/8.
- `pnpm test` → **181/181** (customer 26, partner 30, admin 23, API 102 — was 180, the new
  one is the role-hue contract test).
- `pnpm build` → 4/4 services.
- Chromium: `/search` hard-loaded 3× at 1440px and 1× at 390px with all 12 cards at
  `opacity: 1`; hero columns measured flush with the scene keeping its framing; admin
  users table, dashboard charts and login heading re-screenshotted after the fixes.

### Docs

- `docs/REDESIGN_NOTES.md` — new "Fifth pass — design consistency + a blank-results bug"
  section; verification block updated to 181/181.
