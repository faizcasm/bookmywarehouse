# BookMyWarehouse frontend refinement

## Changes in this pass

- Added responsive layout guardrails to customer, partner, and admin apps to reduce viewport overflow and keep nested flex/grid children shrinkable.
- Refined customer hero/search surfaces, listing cards, container sizing, and small-screen navigation dropdown sizing.
- Standardized minimum control/tap sizes and visible keyboard focus styles.
- Added narrow-screen spacing and dashboard table safeguards for partner/admin views.
- Added `prefers-reduced-motion` handling to all three frontends.
- Kept route definitions, API clients, authentication logic, and booking workflows untouched.

## Second pass — fixes applied on top of this pass

The three defects below were found by re-verifying this work in the workspace (class
coverage against the *built* CSS, plus a headless-browser pass) rather than by trusting
a green build — a green build does not prove that a class has styles.

1. **Hero 3D scene rendered as a 150px strip (customer).** `.hero-scene-canvas` — the
   root of `HeroScene` — had no rule at all, so the canvas fell back to its intrinsic
   height inside a 900px-tall card, and (per its own source comment) it never got the
   intended `pointer-events: none`. Added an absolute-fill rule with
   `pointer-events: none`.
2. **Hero laid out stacked instead of two columns (customer).** The restored stylesheet
   declared `.hero-grid { grid-template-columns: 1.4fr 1fr }` at ≥1024px. Unlayered CSS
   outranks Tailwind v4's layered utilities, so it beat the markup's `lg:grid-cols-12`,
   and the children's `lg:col-span-7` / `lg:col-span-5` then spilled onto phantom auto
   tracks: computed columns came out as `527px 376px 0 0 0 0 0`, pushing the scene onto a
   second row (1128px wide) below full-bleed copy. Removed the duplicate declaration so
   the markup's 12-column grid applies — copy 700px + scene 484px, side by side.
3. **Partner auth brand lockup unstyled + invisible inner orbit ring (partner).**
   `AuthShell` renders `.brand` / `.brand-mark` / `.auth-brand-mark` / `.orbit-ring--outer`
   (the same markup as the customer app), but the partner sheet defined none of them, so
   the "BMW" chip was plain unstyled text. `.orbit-ring--inner` also used
   `border-color: rgb(var(--brand) / 0.32)`, which is invalid once `--brand` substitutes to
   `#10b981` — the declaration was dropped and the ring fell back to `currentcolor`, i.e.
   invisible on the dark panel. Ported the token-driven brand rules and the outer ring,
   and switched the inner ring to `color-mix(in oklab, var(--brand) 32%, transparent)`.

Classes still absent from the built CSS were checked and are non-defects: `is-read`
(`.notification-row.is-unread` carries the emphasis; read rows use the base look),
`mobile-open` (the drawer is driven by `.mobile-filters-overlay`), `brand-footer`
(colour comes from `.auth-brand .brand-text`), `revenue-block` / `review-card` (those
elements also carry `card`), `bell-btn` (`.icon-btn` is already `position: relative`).

## Third pass — responsiveness

Everything below was measured in a headless browser at 320 / 375 / 390 / 420 / 768 /
1024 / 1440 rather than eyeballed. Two audits were run against the Vite dev servers:
the public routes, and — via a mock API that answers with the real `{ success, data,
meta.pagination }` envelopes and deliberately long strings — 43 authenticated routes
(tables, dashboards, search grids, chat, invoices) that a logged-out sweep cannot reach.
Every page was scanned for content spilling past the right edge, content clipped inside
its own box, and undersized touch targets.

**Removed the footer e-mail.** `support@bookmywarehouse.dev` was the widest single
string in the footer and, at phone widths, the reason the Support column wrapped
mid-phrase. The column keeps "Raise a dispute" and "Messages".

**The recurring root cause: `min-width: auto`.** Grid and flex children refuse to shrink
below their content's min-content width, and `1fr` tracks are really `minmax(auto, 1fr)`.
One long child therefore widened its whole row past the viewport, and because
`body { overflow-x: clip }` hides the resulting scroll, the content was simply cut off.
Measured offenders, all fixed with `min-width: 0` / `minmax(0, 1fr)`:

| Where | Measured at 320px |
| --- | --- |
| Customer hero column | 332.8px inside a 276px track — eyebrow, headline, both search fields and the Search button were clipped |
| Customer auth shell | 384px inside a 320px window — the login/register card was cut off |
| Customer invoice "Billed to / Issued by" | 517px — one unbreakable e-mail address; needs `overflow-wrap: anywhere`, since `break-word` does not reduce intrinsic size |
| Register role cards | +3px past the edge; at tablet width the "Customer" label also slid under its check badge (fixed with reserved right padding) |
| Admin booking detail | 1127px inside a 1024px window — the "Timeline" card was cut off |

**Headers.** Brand + theme + bell + avatar + menu stopped fitting on one row at ≤375px,
pushing the menu button to `right=390px` and the user pill to `right=340px`. The first
name is now dropped below 480px (the avatar identifies the account), and the wordmark
scales down so it is whole from 375px up; below that the compact "BMW" mark stands alone
rather than showing a chopped wordmark. The same treatment was applied to the partner and
admin topbars, where page titles were being ellipsised down to 71–93px — they now wrap to
two lines instead.

**Touch targets.** Footer links were 29px tall, the password-reveal toggle 27×27, and
standalone action links ("View booking", "Load older messages") 16–25px. All are now ≥34px.
Links inside a sentence were deliberately left alone — WCAG 2.5.8 exempts those (the
"inline" exception).

**Smaller corrections.** Footer stayed two columns on phones because the `max-width:
1020px` rule appears later in the file than the `560px` one and wins by source order; the
profile avatar `<input type="file">` has a ~335px intrinsic width that pushed its wrapper
off-screen; the admin reviews filter select kept its full option width and overflowed at
320px (option label shortened to "All statuses" and `.select--sm` capped).

What is intentionally still scrollable, and is not a defect: tab strips, data tables
(`.table-wrap`) and the hero's type tabs use horizontal scroll containers, so their
off-screen children are reachable rather than lost.

## Fourth pass — production readiness

Triggered by "the menu bar and theme icon should be at the right end" plus a request to
treat this as a real product. Two independent audits ran first — an API security/
operations review and a frontend hygiene review — and only verified findings were fixed.

### Header control order (the reported issue)

`ThemeToggle` was the **first** child of every actions cluster, so it rendered in the
middle of the header (immediately after the nav) while the menu button sat at the right
edge. It is now the **last** child in all three apps, so both controls end the row:

| App | Order before | Order after |
| --- | --- | --- |
| customer | theme, bell, account, menu | bell, account, menu, **theme** |
| partner | theme, bell, account | bell, account, **theme** |
| admin | bell, theme, sep, account | bell, sep, account, **theme** |

Verified in Chromium with the action cluster measured element-by-element: at 1280 / 768 /
420 / 375 / 320 the customer row reads `bell → account → menu → theme`, the theme button
is the right-most element (`right` = viewport gutter at every width), and nothing exceeds
the viewport.

### Security fixes (API)

1. **Payment forgery — critical.** `POST /payments/simulate` accepted any authenticated
   user's `paymentId` and, through the real webhook pipeline, flipped that payment to
   `SUCCEEDED`, moved the booking to `CONFIRMED` and issued an invoice — for free, on
   someone else's booking. It now verifies `booking.customer === caller` (the same check
   `verifyCheckoutPayment` already had) and refuses outright when `isProd`. Audit entry
   recorded. Regression test: a stranger gets 403, the payment stays `PENDING`, the owner
   still succeeds.
2. **Spoofable rate limiting.** `app.set('trust proxy', true)` was hardcoded, so the
   client-controlled `X-Forwarded-For` header fed both `express-rate-limit` and audit
   IPs — rotating that header bypassed the 20-per-15-min auth lockout. Now driven by the
   already-defined `TRUST_PROXY` env var (default off).
3. **Revoked sessions stayed valid.** `authenticate` read `payload.sid` but never checked
   it, so an access token kept working for up to 15 minutes after Sign out *and* after
   rotation-reuse detection revoked the whole session family. `sid` is the `RefreshToken`
   `_id`, so this is one primary-key lookup: revoked or missing → 401.
4. **Dev secrets reaching production.** The env loader silently substituted the published
   `dev-insecure-…` placeholders whenever `NODE_ENV` wasn't exactly `production`. It now
   refuses to boot on a deployment platform (Vercel/Render/Railway/Heroku/AWS env
   markers, which can't be "forgotten" the way `NODE_ENV` can) and rejects any
   placeholder value that survives into production. Anyone knowing the pattern could
   otherwise have minted admin tokens.
5. **Dead rate limiter wired up.** `sensitiveLimiter` (20/min) was exported and never
   attached to a route; sensitive operations fell back to the 300/min global. Now on
   `change-password`, user moderation, refunds, dispute resolution, settings updates and
   CSV exports.
6. **CSV formula injection.** `csvField` now prefixes `=`, `+`, `-`, `@`, tab and CR with
   an apostrophe. Exports contain partner-authored listing titles and user e-mails, so a
   title like `=cmd|'/C calc'!A0` executed on open in Excel. Four assertions added.
7. **Refresh cookie outliving its session.** Cookie `maxAge` was hardcoded to 30 days
   while the DB honoured `REFRESH_TOKEN_TTL_DAYS`; both now read the same config.
8. **`/health` disclosed integration config** (email provider + whether an API key was
   set) to unauthenticated probes — removed.

### Production operations (API)

9. **Indexes were never built in production.** `autoIndex: false` in prod and no deploy
   step runs `pnpm db:indexes`, so a fresh database served every search and list
   unindexed. `connectDatabase` now runs one non-blocking `syncIndexes()` pass per
   process in production — failures are logged, never fatal.
10. **No access logging.** Only failures were logged, so ops could see *that* something
    broke but not what was called or how slow it was. Added a completion logger
    (`method`, `path`, `status`, `durationMs`, `requestId`, `userId`) that records on
    `res.finish`, levelled by status and skipping health/docs probes.
11. **Missing partner booking index.** Partner lists filter on `{partner}` (+status) and
    sort `createdAt`, which no declared index covered → in-memory sort. Added
    `{partner, status, createdAt}`.
12. **Upload size cap applied to the wrong path.** The 400 KB inline-storage cap ran
    *before* the Cloudinary branch, so even with Cloudinary configured larger uploads
    were rejected — while the error message told you to configure Cloudinary. The cap
    now applies only to inline dev storage.

### Frontend

13. **No error boundary in any app — critical.** A render exception or a failed lazy
    chunk white-screened all three SPAs with an empty `#root`. Each app now has an
    `ErrorBoundary` with a reload affordance, and the customer's lazy 3D hero goes
    through a `lazyWithRetry` helper so one transient network blip doesn't permanently
    break the home page.
14. **partner/admin had no favicon or icons at all** (`public/` didn't exist → 404 on
    every tab, bookmark and history entry), plus no `description` and no OG tags.
    Icon sets copied, relative icon paths added (they must work both at `/` in dev and
    `/partner/`, `/admin/` on Vercel), `robots.txt` added for the two private consoles
    (`Disallow: /`), and OG/twitter descriptions added to both.
15. **customer declared `twitter:card=summary_large_image` with no image anywhere** —
    now `summary` with a real `og:image`/`twitter:image`.
16. **admin preconnected to Google Fonts it never loads** (fonts are self-hosted via
    `@fontsource-variable/inter`) — two dead connections per page load, removed.
17. **partner had no 404**: the `*` route redirected to the dashboard, so broken links
    silently landed on unrelated content. It now renders a NotFound page inside the
    authenticated shell, matching customer and admin.
18. **Duplicate DOM id** `city-suggestions` — the desktop sidebar and mobile filter
    drawer both render one, and they coexist when the drawer is open, so `list=`
    resolved to the wrong element. Split into `-desktop`/`-mobile`.
19. **partner/admin never updated `document.title`** — the tab kept the static
    `index.html` title while the `<h1>` changed. Both shells now set it.
20. **`target="_blank"` with `rel="noreferrer"` only** (5 sites) → `noopener noreferrer`
    for older-browser parity; **content images with `alt=""`** (listing covers) now use
    the listing title; **React Router v7 future flags** opted in, removing two
    deprecation warnings from every page load; **2 of 8 `exhaustive-deps` suppressions
    removed** where provably safe — the other 6 kept with a written reason, since each
    would either loop or change behaviour.

## Verification status

All checks were executed in this workspace (dependencies installed, lockfile unchanged):

```bash
pnpm install --frozen-lockfile   # lockfile up to date
pnpm lint                        # 0 errors (2 pre-existing no-console warnings in build scripts)
pnpm typecheck                   # 8/8 workspace projects pass
pnpm test                        # 180/180 (customer 26, partner 30, admin 22, API 102 —
                                 # including 3 new security regression tests)
pnpm build                       # API bundle + 3 Vite SPAs build clean
```

Because a passing build says nothing about whether a class has styles, a headless-browser
pass (Playwright + Chromium against the Vite dev servers) was run as well:

- 34 routes across the three SPAs: no page errors, no unstyled/thin content, and no
  horizontal scrolling at 1366px or 390px.
- Hero scene measured at 1126×900 inside its 902px card after fix 1 (150px before).
- Hero grid measured as 12 columns with copy 700px / scene 484px after fix 2 (7 phantom
  tracks, stacked, before).
- Partner `.brand-mark` measured with padding, 8px radius and the `--grad-brand`
  background after fix 3.

## Deployment notes

- Rebuild the Vercel projects from source; do not upload a stale `.vercel/output` directory.
- Verify customer, partner, and admin projects against their configured API base URLs and production environment variables.
- Exercise login/logout, listing search/detail, booking creation, partner listing management, and admin moderation after deployment.
- API integration tests and the E2E suite both need a reachable MongoDB Atlas cluster;
  neither is runnable without it.
