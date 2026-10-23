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

## Fifth pass — design consistency + a blank-results bug

Triggered by "still not aligned design … make it the best production ready platform end to
end". A headless design-QA sweep of all three SPAs (18 screenshots at 1440px and 390px,
logged in and out) found one blank-page defect and several consistency gaps.

### 1. `/search` rendered zero listing cards on a hard load (critical)

Directly loading or refreshing `/search` — the core marketplace page — showed
"66 listings found" above an **empty grid**. SPA navigation to the same route worked, so
manual clicking never reproduced it.

Cause: the results grid wrapped its cards in `<AnimatePresence mode="popLayout">`, whose
children use inherited `motion` variants (`initial="hidden"`, resolved from a `stagger`
parent). On a hard load the data arrives after mount, and the pop-layout presence context
fails to resolve the inherited `show` variant for late-mounted children, so each card
stayed pinned at its `hidden` state — `style="opacity: 0; transform: translateY(8px)"`
forever. Every other list in the app (bookings, notifications, invoices, disputes) renders
plain inherited-variant children with no `AnimatePresence` wrapper and was unaffected.

Fix: dropped the wrapper and render the mapped `motion.div` children directly. Verified
with 3 consecutive hard loads at 1440px and 1× at 390px — all 12 cards at `opacity: 1`,
none stuck.

### 2. Same booking status, different colours in each console

Statuses were coloured per-app, so a `CONFIRMED` booking was **green** in customer and
partner but **blue** in admin; `AWAITING_PAYMENT`, `IN_PROGRESS` and `REFUNDED` also
diverged, and customer rendered `CANCELLED` red where both consoles used neutral. Because
admin read `statusTone` from its own map, the fix is to treat the map as a contract rather
than a per-page choice.

- Aligned `apps/admin/src/lib/format.ts` booking tones to the partner/customer values.
- Aligned customer's `CANCELLED` to `neutral` (matching both consoles).
- Aligned verification `SUBMITTED` and invoice `REFUNDED`.
- Documented the contract in the source and locked all eleven booking tones in
  `apps/admin/src/test/format.test.ts` so a future edit to one app fails loudly.

### 3. Role badges were visually identical

`--info` and `--accent` resolve to the **same** blue in the token layer, so the admin
users table rendered `CUSTOMER` and `PARTNER` as the same colour (and `IN_PROGRESS` as
`info`). Gave each role a distinct hue — customer blue, partner green, admin red — and made
`UsersPage` read the shared `toneFor('role', …)` map instead of an inline ternary, so the
map is now the single source of truth. Added a test asserting the three roles differ.

### 4. Admin dashboard charts used swapped colours

The revenue line chart was **blue** and the bookings bar chart **green** — the reverse of
the partner console. Passed the brand token to the line chart and the accent token to the
bar chart, threaded the colour through both components' tooltips and hover cursors so the
swatch always matches the series, and matched the metric→colour convention used on the
partner dashboard (revenue = brand green, volume = accent blue).

### 5. Hero alignment (the reported issue)

- **Headline:** `text-wrap: balance` with the old `13ch` cap still stranded "equipment" and
  "& logistics" on their own lines at desktop sizes. Widened the cap to `22ch` (the
  `col-span-7` column already bounds the real width) — now three even lines.
- **Scene column:** the grid used `align-items: start` and the scene kept a fixed 4:3/5:4
  ratio, so it ended ~200px above the search card. The grid item now stretches and the
  inner frame fills it, so both columns end flush.
- **3D framing:** stretching the frame makes it taller than wide (w/h 0.82), and a fixed
  vertical-FOV camera loses horizontal coverage as the frame narrows — which cropped the
  warehouse. Added `ResponsiveCamera`, which dollies the camera back by exactly
  `designAspect / aspect` so the horizontal framing matches the composed 5:4 pose and the
  extra vertical space shows more sky and yard. The camera pose is owned there rather than
  in the `Canvas camera` prop, because R3F re-applies that inline prop on every parent
  re-render and silently resets a manual dolly.

### 6. Login and profile polish

- **Admin login** had no heading — just the "Admin console" brand row above the fields.
  Added a real `<h1>` and a lead line ("Restricted access — every sign-in is logged for
  audit") so it matches the customer and partner login cards.
- **Profile avatar** used the raw `<input type="file">` ("Choose File / No file chosen").
  Replaced it with a labelled button; the native input stays in the DOM, visually hidden
  but focusable, with a focus ring on the visible label.

## Sixth pass — navbar alignment: menu + theme at the right end

Reported: *"menu bar and theme changer on navbar should be on right side end like the
BookMyWarehouse [brand] is on left end of navbar."* Measured every header in Chromium
(logged in, 1440/1023/970/768/560/390/320) before touching anything — two of the three
apps were wrong, and the third was wrong in a way only a measurement could show.

### 1. Customer: the controls were not at the right end (below 1024px)

`.header-nav` owned the `margin-left: auto` that pins the row to the right edge. The nav
collapses into a dropdown at ≤900px, and a hidden element has no auto margin — so
`.header-actions` packed left and left dead space: **33px at 390px, 271px at 768px**
(theme toggle ending at x=347 inside a container that ends at x=380). `.header-actions`
now owns `margin-left: auto; flex-shrink: 0`, so the theme toggle ends exactly on the
content column's right edge at every width, nav or no nav.

### 2. Customer: the header row spilled out of its content column at 901–1023px

Tailwind's `container` utility caps `.container` at 768px across that band (the app's own
`.container` rules set width only, no max-width — the cap comes from the layered utility).
The header still laid out brand + search + inline nav + controls, measuring **844px of
content inside the 768px column at 970px**: the brand sat on the column's left edge while
the controls ran ~93px past its right edge. The nav now collapses at ≤1023px (the search
field survives until ≤900px), so the row always fits the column. Across 24 measured
widths from 1440px to 320px: brand left == container left, actions right == container
right, `scrollWidth == innerWidth` everywhere.

### 3. Partner + admin: the menu button sat on the wrong end

Both consoles put the hamburger at the topbar's *left* end, ahead of the page title, with
only the theme toggle on the right. The menu control moved into the actions group,
immediately before the theme toggle, so all three apps read the same way:
brand (left) … bell, account, **menu, theme** (right end, theme outermost — the control
order established in the fourth pass). The admin burger also gained `aria-controls`,
`aria-expanded` and a state-dependent label.

### 4. Consoles lost their brand as soon as the sidebar collapsed

The brand lived only in the sidebar, so on a phone the topbar started with a bare page
title. Added a `BMW` mark (+ `BookMyWarehouse` wordmark above 560px) at the topbar's left
end, shown **only while the sidebar is hidden** (≤900px partner, ≤960px admin) — desktop
never shows it twice. Below 560px the wordmark drops: mark + wordmark + four controls
would leave the page title no room.

### 5. 320px squeeze on the consoles

Brand + bell + account + menu + theme left the title 61px of room for 66px of text —
admin rendered "Dashb…" and partner broke "Dashboard" mid-word ("Dashboar / d"). The
account pill's caret/chevron and the mark trim at ≤360px; titles now measure 92px (admin)
and 84px (partner, at 0.9rem) of room and stay on one line, while multi-word titles keep
the intended two-line wrap.

### 6. The drawer's close button was unclickable (found while verifying)

The partner scrim (z 55) and admin backdrop (z 50) both sit over the topbar (z 30), so
once the rail opened, the X it was showing was behind the overlay — the only way out was
tapping the scrim. The topbar now rises to z 56 *only while the rail is open*: above the
overlay, below the sidebar (60), so the sidebar brand is never covered.

## Seventh pass — the hero's 3D scene is gone, replaced by a static showcase card

Requested: *"remove the 3d object from homepage instead add a beautiful static object or
card type."* The React Three Fiber scene is deleted outright, not merely bypassed, because
a decorative hero is exactly the wrong place to spend a WebGL runtime.

### What it cost before

The scene was the customer app's only code-split chunk, so it also justified machinery
that existed solely for it: `lazyWithRetry` (retry a failed chunk fetch), `useHeroSceneMode`
(probe `prefers-reduced-motion`, `deviceMemory ≤ 4`, `saveData`, and `getContext('webgl2')`
to decide between '3d' and 'fallback'), a Suspense fallback, and a second static fallback
path. Removing it took **13 packages out of the lockfile** (`three`, `@react-three/fiber`,
`@types/three` and their tree) and dropped the customer bundle to a single 521.73 kB chunk —
the 831 kB three.js chunk no longer exists. `lazyWithRetry` went with it: it had no other
caller in any app.

### What replaced it

`apps/customer/src/components/HeroShowcase.tsx` — a presentational, zero-dependency card:

- **Art panel**: an inline SVG night scene of a logistics hub (gable roof with the teal
  ridge highlight, a "COLD STORAGE HUB" sign, three shutter doors — the middle one open and
  lit — dock bumpers and levelers, a branded outbound truck, stacked pallets, a distant
  skyline and a moon). It is `aria-hidden` like the scene it replaced; the copy beside it
  already says everything the mock shows, so there is nothing to announce.
- **Overlay pills**: "★ 4.9 · 128 reviews" and "✓ Verified partner" over the art. Below
  420px the review tail is dropped so the two pills never collide (measured: they don't at
  any width down to 320px).
- **Summary body**: kicker, title, three spec chips, price and a gradient CTA.
- **A "Booking confirmed" card straddling the seam** between the art and the body — it hangs
  out of the art box, and the frame's `overflow: hidden` keeps it inside the card.

The illustration keeps its own deep-navy/emerald palette in both themes (a night scene has
one correct appearance), while the pills, body, float and CTA are theme tokens, so the card
follows light/dark like the rest of the page.

### Layout, measured not assumed

The column used to size itself from an aspect ratio (`aspect-[4/3]` → `lg:aspect-[5/4]`,
then `aspect-ratio: auto; height: 100%` to stretch). A static card has no natural ratio, so
`.hero-visual` now owns its height (`min-height: 420px`, `460px` and `align-self: stretch`
at ≥1024px) and the card fills whatever the grid hands it. Two defects found and fixed only
by measuring at real widths:

1. **320px orphaned "month" onto its own line.** The price needed 110px and the CTA 117px
   inside a 239px row; flex shrank the price by 0.3px, which is enough to wrap it. The price
   now has `flex-shrink: 0` and the row tightens at ≤360px — the footer measures 34.2px tall
   (one line) at 320/360/390px instead of 55px.
2. The art gradient matches the illustration's sky, so the letterboxing that
   `preserveAspectRatio="xMidYMid meet"` leaves on tall frames is invisible.

Chromium verified at 1440/1024/768/390/320px in light and dark: no pill collision, the
booking card stays inside its frame, and `scrollWidth == innerWidth` everywhere.

## Verification status

All checks were executed in this workspace (seventh pass: `pnpm install` re-ran after the
3D deps were removed, taking 13 packages out of the lockfile):

```bash
pnpm install                        # lockfile synced: -13 packages (three, fiber, types)
pnpm lint                        # 0 errors (2 pre-existing no-console warnings in build scripts)
pnpm typecheck                   # 8/8 workspace projects pass
pnpm test                        # 181/181 (customer 26, partner 30, admin 23, API 102 —
                                 # including 3 security regression tests and the new
                                 # cross-console tone + role-hue contracts)
pnpm build                       # API bundle + 3 Vite SPAs build clean; customer is now a
                                 # single 521.73 kB chunk (the 831 kB three.js chunk is gone)
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
- Fifth pass: `/search` hard-loaded 3× at 1440px and 1× at 390px — all 12 cards at
  `opacity: 1` (previously stuck at 0 on every hard load); hero columns end flush and the
  3D scene keeps its horizontal framing at the stretched aspect; admin users table shows
  three distinct role hues; admin dashboard revenue line renders brand green and bookings
  bars accent blue; admin login renders its new heading.
- Sixth pass: the three headers measured at 24 widths (1440 → 320px) — brand at the content
  column's left edge, menu + theme toggle at its right end, `scrollWidth == innerWidth`
  everywhere; the customer nav collapses into the menu button at ≤1023px with the search
  field still inline at 970px; drawer/rail open-and-close clicked through at 390px in all
  three apps; partner and admin page titles stay on one line at 320px.
- Seventh pass: the hero showcase card screenshotted and measured at 1440/1024/768/390/320px
  in light and dark — the art panel and summary never overlap the booking card, the two
  overlay pills don't collide (the review tail drops below 420px), the price row is one line
  at every width (34.2px, was 55px with "month" orphaned at 320px), the card stays inside
  its frame, and `scrollWidth == innerWidth` everywhere. The customer bundle is a single
  521.73 kB chunk; the three.js chunk and its lazy/fallback machinery are gone.

## Deployment notes

- Rebuild the Vercel projects from source; do not upload a stale `.vercel/output` directory.
- Verify customer, partner, and admin projects against their configured API base URLs and production environment variables.
- Exercise login/logout, listing search/detail, booking creation, partner listing management, and admin moderation after deployment.
- API integration tests and the E2E suite both need a reachable MongoDB Atlas cluster;
  neither is runnable without it.
