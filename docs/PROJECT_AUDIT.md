# BookMyWarehouse — Project Audit

Status snapshot of the repository after the BookMyStudio-inspired redesign and the
follow-up finishing pass. Every claim here reflects code that exists in this repo;
commands that were executed to verify it are listed in `PROGRESS.md`.

## Architecture (unchanged)

Monorepo (pnpm workspaces) on MERN + TypeScript, deployed as one Vercel project with
four services:

| Service | Path | Stack | Port (dev) |
| --- | --- | --- | --- |
| Customer SPA | `apps/customer` | React 18 + Vite + Tailwind v4 + `@bmw/ui` | 5173 |
| Partner SPA | `apps/partner` | React 18 + Vite + Tailwind v4 + `@bmw/ui` | 5174 |
| Admin SPA | `apps/admin` | React 18 + Vite + Tailwind v4 + `@bmw/ui` | 5175 |
| API | `apps/api` | Express + Mongoose + Zod | 5176 |

Shared packages: `@bmw/shared-types`, `@bmw/validation`, `@bmw/ui` (design tokens,
theme provider, shadcn-style kit, motion variants).

Routing on Vercel: `/` + `/(.*)` → customer, `/partner(/.*)` → partner,
`/admin(/.*)` → admin, `/api/(.*)` + `/health` → api.

## Design system

Single token source: `packages/ui/tokens.css` (slate surfaces, emerald accent, light
on `:root` / dark on `[data-theme="dark"]`, mapped through Tailwind v4 `@theme inline`).
`ThemeProvider`/`ThemeToggle` (light · dark · system) persist under `bmw-theme` with a
no-FOUC bootstrap in each `index.html`. Dark mode is driven by the `data-theme`
attribute end-to-end.

## Route map (customer SPA)

Public: `/`, `/search`, `/listing/:slug`, `/login`, `/register`, `/forgot-password`,
`/reset-password`, **`/terms` (new)**, **`/partner-benefits` (new)**.
Authenticated: `/bookings`, `/bookings/:id`, `/pay/:bookingId`, `/invoices`,
`/invoices/:id`, `/favorites`, `/reviews`, `/messages`, `/messages/:id`,
`/notifications`, `/disputes`, `/profile`. Fallback: 404 page.

Partner SPA: onboarding, dashboard, listings CRUD, availability, booking requests,
earnings/payouts, reviews, messages, notifications, profile/settings.
Admin SPA: dashboard, users, partner verification queue, listing moderation, bookings,
payments, refunds, disputes, reviews, categories, settings, audit logs.

## Issues found & fixed in this pass

1. **Broken working tree (critical).** The `styles.css` in the working copy had been
   reverted to a pre-redesign electric-blue file that lacked the `bento-card`,
   `nav-pill`, `stagger-*` and `hero-*` classes `HomePage.tsx` depends on — the
   homepage rendered unstyled. Restored `apps/customer/src/styles.css` to the coherent
   BookMyStudio version that matches the committed `HomePage.tsx`. Kept the working-copy
   `tokens.css` improvements (they were a genuine fix, see #2).
2. **Dark mode + shared tokens regression.** The redesign's `tokens.css` had (a) switched
   the Tailwind `dark:` variant to a `.dark` class while the app only ever sets the
   `data-theme` attribute, and (b) dropped `--bg-grid` / `--glass-strong` that the
   partner and admin stylesheets still reference. The working-copy `tokens.css` fixes
   both (variant → `[data-theme='dark']`, re-adds the two tokens). Kept.
3. **Homepage sections permanently invisible (critical).** `App.tsx`'s scroll-reveal
   adds the class `is-in`, but the CSS matched `.reveal.is-visible` — so every `.reveal`
   section stayed at `opacity: 0`. Renamed the three CSS rules to `.reveal.is-in`.
4. **Dead dark-mode rules.** Five `.dark .step-badge` rules targeted a `.dark` class that
   is never applied. Rewritten to `[data-theme='dark'] .step-badge`.
5. **Dead internal links (404s).** `HomePage` linked to `/terms` and `/partner-benefits`
   with no matching routes. Added `TermsPage` and `PartnerBenefitsPage`, registered the
   routes, and linked them from the footer (incl. a Terms link in the footer bottom).
6. **Lint failure.** `categoryList` was assigned but never used in `HomePage.tsx`.
   Removed.
7. **Leftover artifact.** Deleted the committed `apps/customer/src/styles.css.bak`
   backup file.
8. **Theme meta mismatch.** `applyTheme` in `@bmw/ui` set the `<meta name="theme-color">`
   to the old electric-blue hexes; aligned to the slate palette used by the bootstraps.

## Verified

- `pnpm lint` — 0 errors (2 pre-existing `console` warnings in build scripts only).
- `pnpm typecheck` — all 8 workspace projects pass.
- `pnpm build` — API bundle + 3 Vite SPAs build clean.
- Frontend unit tests — customer 26/26, partner 30/30, admin 22/22 = **78/78**.
- API unit tests — pricing / transitions / validation pass. DB-backed integration tests
  require network access to MongoDB Atlas, which is unavailable in this sandbox
  (`querySrv EBADRESP`); no API code was changed in this pass.

## Known limitations / requires external configuration

- **Payments** — live Razorpay needs real `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` /
  `PAYMENT_WEBHOOK_SECRET`. The API refuses to boot in production without the webhook
  secret (anti-forgery guard). Sandbox mode is used otherwise.
- **Emails** — Resend delivery is env-gated; without `RESEND_API_KEY` emails are logged
  only (documented, not silently faked).
- **Image uploads** — Cloudinary credentials required for production image storage.
- **MongoDB** — production needs a reachable Atlas cluster + `pnpm db:indexes`.
- These are configuration boundaries, not code defects. See `docs/DEPLOYMENT.md`.
