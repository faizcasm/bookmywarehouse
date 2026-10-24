# BookMyWarehouse — Mobile Migration Plan

**Status:** Phase 1 complete (audit), implementation in progress
**Date:** 2026-10-23
**Target:** Android + iOS via React Native (Expo) + TypeScript, sharing the existing backend.

---

## 1. Executive summary

The existing product is a pnpm monorepo containing one Express/MongoDB API and three React
(SPAs): customer (the public site at `https://bookmywarehouse.vercel.app`), partner
(`/partner`) and admin (`/admin`). All three call the same REST API under `/api/v1` and share
the same JWT + refresh-cookie session.

The mobile app is a **fourth client** of that same API — a single Expo application with
role-based navigation (customer / partner / admin) chosen after login from the `/auth/me`
role. It does **not** duplicate business logic: every rule (booking state machines, pricing,
moderation, refunds) stays server-side. The web SPAs are untouched and remain deployed.

## 2. What exists today (audit summary)

Full detail lives in `MOBILE_FEATURE_AUDIT.md`; the headline facts that shape this plan:

| Area | Fact |
| --- | --- |
| Backend | Express 4 + Mongoose 8 + Zod; mounted at `/api/v1`; health at `/health`; deployed on Vercel (`vercel.json` multi-service). |
| API contract | Envelope `{ success, data, meta?, requestId? }`; errors `{ success:false, error:{code,message,issues?}, requestId? }`; paginated lists use `page`/`limit` + `meta.pagination`. |
| Auth | `POST /auth/login` → `{ user, accessToken, csrfToken }` in body + `bmw_rt` httpOnly cookie (refresh, scoped `/api/v1/auth`) + readable `bmw_csrf` cookie. Access token 15 min; refresh 30 days with rotation + reuse detection. |
| CSRF | Double-submit, enforced **only when the `bmw_csrf` cookie is present** (`apps/api/src/middleware/csrf.ts:42`). Pure-Bearer clients (no cookies) pass untouched. |
| Customers | 21 routes (`apps/customer/src/App.tsx:103-210`): browse/search/detail, auth, bookings, pay, invoices, favorites, reviews, messages, notifications, disputes, profile, legal. |
| Partners | 16 routes (`apps/partner/src/App.tsx:25-69`): dashboard, listings CRUD + availability, booking triage, earnings, reviews, messages, onboarding, KYC/verification, profile, settings. |
| Admin | 18 routes (`apps/admin/src/App.tsx`): users, partners, verification queue, listing moderation, bookings, payments, refunds, invoices, disputes, categories, reviews, settings, audit logs. |
| Payments | `SANDBOX` by default in `.env`; Razorpay live mode optional. Sandbox `POST /payments/simulate` drives the full booking→invoice lifecycle without a real gateway. |
| Uploads | `POST /uploads` accepts a base64 data URI; 2 MB body cap; dev stores inline, production uses Cloudinary. |
| Maps | **None.** No map library anywhere in the web apps or API. Location is address + lat/lng text only. |
| Push | **None.** No FCM/APNs backend; notifications are DB records rendered in-app. |
| Offline | **None.** No service worker or sync logic. |

## 3. Goals and non-goals

**Goals**

- Native-feeling Android/iOS app that preserves every customer feature and the partner's
  on-the-go workflows, using the existing API unchanged.
- Preserve branding: emerald `#10b981` on slate surfaces, Inter typography, the light/dark
  theme system (`packages/ui/src/tokens.css`) ported token-for-token to React Native.
- Reuse pure TypeScript logic from the monorepo where it is DOM-free: `@bmw/shared-types`
  enums/money helpers and `@bmw/validation` Zod schemas.
- Real verification: typecheck, lint, unit/integration tests, Metro production bundle, and an
  Android build/emulator run where the environment allows it.

**Non-goals (explicitly out of scope, with reasons)**

- No second backend, no new business rules, no mock data in feature code.
- No push notifications (no backend support; adding one is a server project, not a client one).
- No map SDK (the product has no map; adding one would invent a feature).
- No offline sync (the product has none; requests are made live with retry/queueing only).
- No iOS build/test — this environment is Linux. Documented as a blocker, not claimed done.

## 4. Technology stack

| Concern | Choice | Rationale |
| --- | --- | --- |
| Runtime | Expo SDK 54 + React Native 0.81, TypeScript strict | Current stable SDK; EAS-ready; matches the repo's Node ≥ 20 toolchain. |
| Navigation | Expo Router (file-based) | Deep links, typed routes, nested groups map cleanly onto the web route tables. |
| Server state | TanStack Query v5 | Caching, invalidation, retry, request cancellation — replaces the web `useAsyncData` hook. |
| Forms | React Hook Form + Zod (`zodResolver`) | Same schema source as the API (`@bmw/validation`), shared validation messages. |
| API client | Hand-written typed client (ported from `apps/customer/src/lib/api.ts`) | Must reproduce the envelope, refresh and CSRF conventions exactly; no third-party client does. |
| Sensitive storage | `expo-secure-store` | Refresh + CSRF tokens are credentials; SecureStore uses Keychain/Keystore. |
| Preferences | `@react-native-async-storage/async-storage` | Theme choice, last-visited city, non-sensitive flags. |
| Styling | `StyleSheet` + a token layer mirroring `tokens.css` | Zero extra deps; theme flips by swapping a token object. |
| Icons | `lucide-react-native` | Same icon set the web apps use (`lucide-react`). |
| Testing | `jest-expo` + `@testing-library/react-native` | Matches the repo's vitest style; runs headless in CI. |
| Builds | EAS Build profiles + local Gradle release build | `eas.json` for cloud; Gradle for on-device verification here. |

Dependency count is kept deliberately small; each addition above replaces a specific web
counterpart rather than adding novelty.

## 5. Architecture

```
apps/mobile/                    # new, isolated; web apps untouched
  app/                          # Expo Router routes
    (auth)/login|register|forgot-password|reset-password
    (customer)/…  (partner)/…  (admin)/…     # role-gated groups
    listing/[slug].tsx  …
  src/
    components/                 # reusable UI (Card, Badge, Button, Field, …)
    features/                   # feature modules (booking, payments, messaging, …)
    services/api/               # typed client, auth session, endpoints
    hooks/                      # useQuery wrappers, useSession, usePaginatedList
    schemas/                    # re-exported @bmw/validation + app-side schemas
    types/                      # DTOs re-exported from @bmw/shared-types
    store/                      # session + theme context only
    constants/                  # API URL, breakpoints, copy
    theme/                      # tokens ported from packages/ui/src/tokens.css
    utils/                      # format.ts port, searchFilters port,…
  assets/                       # icon, splash, adaptive icon
```

**Role routing.** A single route group per role, guarded by a `useSession()` hook that reads
the role from `/auth/me`. Guests land on the customer experience; a partner or admin token
routes into their console on cold start, mirroring how the three SPAs guard their own routes
(`RequireAuth` in each app's `RouteGuard.tsx`).

**What is shared vs rewritten:** pure logic (enums, money math, Zod schemas) is imported from
workspace packages; anything DOM-bound (`fetch`/`localStorage`/`document.cookie`, HTML
elements, CSS classes) is rewritten natively.

## 6. Migration phases

| Phase | Scope | State |
| --- | --- | --- |
| 1. Audit | Inspect all four apps + API, write this plan, `MOBILE_FEATURE_AUDIT.md`, `MOBILE_API_INTEGRATION.md`. | ✅ done |
| 2. Foundation | Expo app, strict TS, theme tokens, API client + session storage, navigation shell, UI primitives, env config. | 🚧 |
| 3. Core journeys | Auth, home, search, listing detail, availability → booking → payment (sandbox) → invoice. | ⬜ |
| 4. Remaining features | Partner console (listings, availability, booking triage, earnings, KYC), admin console (moderation, users, payments, disputes), account features (favorites, reviews, messages, notifications, disputes, profile). | ⬜ |
| 5. Quality | `tsc`, ESLint, unit + integration tests, fix root causes only. | ⬜ |
| 6. Device | Android emulator or device run; iOS explicitly not testable on Linux. | ⬜ |
| 7. Release prep | Bundle id, icons, splash, permissions, EAS profiles, env matrix, docs. | ⬜ |

## 7. Scope decision per console

- **Customer — complete.** This is the actual website; every one of its 21 routes is migrated.
- **Partner — complete for mobile.** All 16 routes. The 708-line web listing form becomes a
  guided multi-step native form with the same payload.
- **Admin — mobile-adapted.** All 18 routes exist, but dense desktop tables become card lists
  and CSV exports become native share-sheet exports (via `expo-file-system` +
  `expo-sharing`) instead of browser blob downloads. No feature is dropped; only the
  presentation changes. Raw JSON audit viewers render as scrollable pretty-printed views.

Rationale for one app rather than three: the backend already issues a single token with a
`role`; the web product is one brand; and a user who is both partner and customer would
otherwise juggle two installs with two sessions.

## 8. Environment and configuration

| Env | API base URL |
| --- | --- |
| development (Android emulator) | `http://10.0.2.2:4000/api/v1` |
| development (iOS simulator) | `http://localhost:4000/api/v1` |
| development (physical device) | `http://<LAN-IP>:4000/api/v1` |
| production | `https://bookmywarehouse.vercel.app/api/v1` |

Configured through `EXPO_PUBLIC_API_URL` (Expo's public-env mechanism); `.env.example`
committed without secrets, `.env` git-ignored. The API's CORS allowlist already permits
non-browser clients (`apps/api/src/app.ts:60-63`), so no server change is needed.

## 9. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| httpOnly refresh cookie can't be replayed by a native client | The mobile client captures `Set-Cookie` at login/refresh, stores the values in SecureStore, and replays them **only** on `/auth/refresh` + `/auth/logout`. Regular calls send pure Bearer with no cookies, so CSRF is skipped entirely by design. |
| Razorpay live checkout needs `checkout.js` (web only) | Mobile implements the full SANDBOX flow natively (works today); live-mode Razorpay needs `react-native-razorpay` + build-time keys and is documented as a follow-up, not faked. |
| Disk budget for Android SDK/emulator on this host | Gradle release build verified first; emulator attempted only if space allows, otherwise documented honestly. |
| iOS untestable on Linux | Documented as a blocker; no iOS claims made. |
| Slow tests under parallel load (seen in web suite) | Mobile tests use explicit timeouts where typing-heavy, mirroring the web fix in `apps/partner/src/test/listingForm.test.tsx`. |

## 10. Definition of done

Tracked verbatim from the brief; each item is checked in the final report with the command
output or screenshot that proves it. Known limitations (iOS, live Razorpay, push, maps) are
listed in the final section of `MOBILE_API_INTEGRATION.md` and the release notes.
