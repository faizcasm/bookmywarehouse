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

## Verification status

All checks were executed in this workspace (dependencies installed, lockfile unchanged):

```bash
pnpm install --frozen-lockfile   # lockfile up to date
pnpm lint                        # 0 errors (2 pre-existing no-console warnings in build scripts)
pnpm typecheck                   # 8/8 workspace projects pass
pnpm test                        # frontend 78/78 (customer 26, partner 30, admin 22);
                                 # API: 44 unit tests pass — 55 DB-backed integration tests
                                 # skip, they need a reachable MongoDB Atlas cluster
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
