# BookMyWarehouse — Mobile Feature Audit

Evidence-based inventory of every existing feature, produced by reading the source of the four
web/API packages. Each row names the web implementation, the backend dependency, and the
mobile plan. **Nothing in this document is proposed-but-unbuilt**: "Existing" means the code
is in the repo today; the "Mobile" column states what will be done with it.

Legend for Mobile column: **port** = reimplement natively against the same API ·
**n/a** = not applicable on mobile (reason given) · **adapt** = same feature, native
presentation.

---

## 1. Customer app — `apps/customer` (21 routes, `src/App.tsx:103-210`)

### 1.1 Public browsing

| Feature | Web source | API dependency | Mobile |
| --- | --- | --- | --- |
| Home: hero search, featured listings, categories, value props, trust stats, static showcase card | `pages/HomePage.tsx`, `components/HeroShowcase.tsx` | `GET /catalog/search` (featured), `GET /catalog/categories` | port |
| Search page: query, filters (type, city, price, capacity, amenities, verified, rating, category), sort, pagination | `pages/SearchPage.tsx`, `lib/searchFilters.ts` | `GET /catalog/search?page&limit&…`, `GET /catalog/categories`, `GET /catalog/cities` | port (filter state serialized identically; shareable links → share sheet) |
| Listing detail: gallery, specs, amenities, pricing, location, availability strip, reviews, inquiry form, booking panel | `pages/ListingPage.tsx` | `GET /catalog/listings/:slug`, `GET /catalog/listings/:slug/availability`, `POST /inquiries`, `POST /bookings/quote` | port (image gallery native, availability strip native) |
| Categories browse | `components/…`, search page | `GET /catalog/categories` | port |
| Legal: Terms, Privacy | `pages/TermsPage.tsx`, `pages/PrivacyPage.tsx` | none (static) | port (static screens) |
| "Partner benefits" marketing page | `pages/PartnerBenefitsPage.tsx` | none | port |
| 404 / error pages | `App.tsx` catch-all, `ErrorBoundary` | — | port |

### 1.2 Authentication

| Feature | Web source | API dependency | Mobile |
| --- | --- | --- | --- |
| Login (email+password, role redirect, `next` param) | `pages/LoginPage.tsx`, `auth/AuthContext.tsx` | `POST /auth/login` | port |
| Register (customer/partner role, TOU checkbox) | `pages/RegisterPage.tsx` | `POST /auth/register` | port |
| Forgot password | `pages/ForgotPasswordPage.tsx` | `POST /auth/forgot-password` | port |
| Reset password (token from email link) | `pages/ResetPasswordPage.tsx` | `POST /auth/reset-password` | port (deep link `/reset-password?token=`) |
| Email verification | `auth` + verify page | `POST /auth/verify-email` | port (deep link `/verify-email?token=`) |
| Session restore on boot, route guards | `auth/AuthContext.tsx`, `components/RouteGuard.tsx` | `GET /auth/me`, `POST /auth/refresh` | port — tokens in SecureStore instead of localStorage+cookies |
| Logout | `AuthContext` | `POST /auth/logout` (revokes session) | port |

**Auth storage change (the one deliberate deviation):** the web keeps the access token in
`localStorage` and relies on the browser's httpOnly cookie for refresh. React Native's
`fetch` does not persist cookies across launches, so the mobile client captures the
`bmw_rt` + `bmw_csrf` values from `Set-Cookie` at login/refresh, stores them in
`expo-secure-store`, and replays them as a `Cookie` header on `/auth/refresh` and
`/auth/logout` only. All other requests send **pure Bearer with no cookies**, which the API's
CSRF middleware explicitly allows (`apps/api/src/middleware/csrf:42` — "Requests without the
cookie (pure bearer-token API clients) pass through"). Server behaviour is unchanged.

### 1.3 Account features (auth-guarded)

| Feature | Web source | API dependency | Mobile |
| --- | --- | --- | --- |
| Bookings list (tabs by status) + detail (timeline, actions, cancel) | `pages/BookingsPage.tsx`, `pages/BookingDetailPage.tsx` | `GET /bookings`, `GET /bookings/:id`, `POST /bookings/:id/cancel` | port |
| Payment (sandbox simulate / Razorpay live) | `pages/PayPage.tsx` | `GET /payments/config`, `POST /payments/initiate`, `POST /payments/simulate`, `GET /payments/:id/status` | port for SANDBOX; live Razorpay → `react-native-razorpay` documented as follow-up (needs native module + keys) |
| Invoices list + detail (printable HTML) | `pages/InvoicesPage.tsx`, `pages/InvoiceDetailPage.tsx` | `GET /payments/invoices`, `GET /payments/invoices/:id`, `…/html` | port; "print" becomes native share/print via `expo-print` |
| Favorites (add/remove, list) | `pages/FavoritesPage.tsx` | `GET/POST/DELETE /favorites` | port |
| Reviews (create for completed booking, list) | `pages/ReviewsPage.tsx` | `GET/POST /reviews` | port |
| Messages: conversation list + thread + send | `pages/MessagesPage.tsx`, `pages/ConversationPage.tsx` | `GET /conversations`, `GET /conversations/:id/messages`, `POST …/messages` | port (polling; no websocket exists server-side) |
| Notifications list + mark read | `pages/NotificationsPage.tsx` | `GET /notifications`, `PATCH /notifications/:id`, `POST /notifications/read-all` | port (in-app only — no push backend) |
| Disputes: open against a booking + list | `pages/DisputesPage.tsx` | `GET/POST /disputes` | port |
| Profile: view/edit name+phone, change password | `pages/ProfilePage.tsx` | `GET /users/me`, `PATCH /users/me`, `POST /auth/change-password` | port |

## 2. Partner app — `apps/partner` (16 routes, `src/App.tsx:25-69`)

| Feature | Web source | API dependency | Mobile |
| --- | --- | --- | --- |
| Login / register (partner) | `pages/Login.tsx`, `pages/Register.tsx` | `POST /auth/login`, `POST /auth/register` | port (shared auth module) |
| Dashboard: stat cards, recent bookings, action list | `pages/Dashboard.tsx` | `GET /partner/dashboard` | port |
| Onboarding: progressive profile steps | `pages/Onboarding.tsx` | `GET/PATCH /partner/profile` | port (native step flow) |
| Listings: list with status filter + quick actions (publish/unpublish/delete/archive) | `pages/Listings.tsx`, `pages/ListingDetail.tsx` | `GET /partner/listings`, `POST /partner/listings/:id/{publish,unpublish,archive}`, `DELETE …` | port |
| Listing create/edit: ~700-line form (basic, location, space, pricing, amenities, images, hours, rules, drafts) | `pages/ListingNew.tsx`, `components/ListingForm.tsx` | `POST /partner/listings`, `PATCH /partner/listings/:id`, `POST /uploads` | adapt — guided multi-step native form, same payload + Zod schema |
| Availability rules + exceptions (bulk weekdays, date ranges) | `pages/Availability.tsx` | `GET/POST/DELETE /partner/listings/:id/availability` | port |
| Bookings: triage list + detail with state actions (confirm/start/complete/cancel) | `pages/Bookings.tsx`, `pages/BookingDetail.tsx` | `GET /partner/bookings`, `POST /partner/bookings/:id/{confirm,start,complete,cancel}` | port (native confirm dialogs) |
| Earnings: stats + payout list | `pages/Earnings.tsx` | `GET /partner/earnings`, `GET /partner/payouts` | port |
| Reviews: respond to customer reviews | `pages/Reviews.tsx` | `GET /partner/reviews`, `POST /reviews/:id/response` | port |
| Messages + conversations | `pages/Messages.tsx`, `pages/Conversation.tsx` | `/conversations` family | port |
| Notifications | `pages/Notifications.tsx` | `/notifications` family | port |
| Verification/KYC: document upload, submit, status | `pages/Verification.tsx` | `GET /partner/verification`, `POST /partner/verification/submit`, `POST /uploads` | adapt — `expo-image-picker` + `expo-document-picker` for uploads |
| Profile / settings / change password | `pages/Profile.tsx`, `pages/Settings.tsx` | `PATCH /users/me`, `POST /auth/change-password` | port |

## 3. Admin app — `apps/admin` (18 routes)

Dense tables adapt to card lists; CSV exports adapt to native share-sheet file exports.
No admin feature is dropped.

| Feature | Web source | API dependency | Mobile |
| --- | --- | --- | --- |
| Dashboard: platform stats + charts | `pages/Dashboard.tsx` (recharts) | `GET /admin/dashboard` | adapt — stat cards native; charts via `react-native-svg`-based chart or numeric summaries |
| Users: search, suspend/activate | `pages/Users.tsx` | `GET /admin/users`, `PATCH /admin/users/:id/status` | adapt (cards + actions) |
| Partners: list, detail | `pages/Partners.tsx` | `GET /admin/partners`, `GET /admin/partners/:id` | adapt |
| Verification queue: review KYC, approve/reject | `pages/Verifications.tsx` | `GET /admin/verifications`, `POST /admin/verifications/:id/{approve,reject}` | adapt |
| Listing moderation: approve/reject/suspend listings | `pages/Listings.tsx`, `pages/ListingDetail.tsx` | `GET /admin/listings`, `POST /admin/listings/:id/{approve,reject,suspend,restore}` | adapt |
| Bookings: all bookings, detail, refund | `pages/Bookings.tsx`, `pages/BookingDetail.tsx` | `GET /admin/bookings`, `POST /admin/bookings/:id/refund` | adapt |
| Payments: list, detail, retry webhook | `pages/Payments.tsx` | `GET /admin/payments`, `POST /admin/payments/:id/retry-webhook` | adapt |
| Refunds: queue, process/void | `pages/Refunds.tsx` | `GET /admin/refunds`, `POST /admin/refunds/:id/{process,void}` | adapt |
| Invoices: list, detail | `pages/Invoices.tsx` | `GET /admin/invoices`, `GET /admin/invoices/:id` | adapt |
| Disputes: queue, resolve | `pages/Disputes.tsx` | `GET /admin/disputes`, `POST /admin/disputes/:id/resolve` | adapt |
| Categories: CRUD | `pages/Categories.tsx` | `GET/POST/PATCH/DELETE /admin/categories` | adapt |
| Reviews moderation | `pages/Reviews.tsx` | `GET /admin/reviews`, `DELETE /admin/reviews/:id` | adapt |
| Platform settings | `pages/Settings.tsx` | `GET/PATCH /admin/settings` | adapt |
| Audit logs viewer | `pages/AuditLogs.tsx` | `GET /admin/audit-logs` | adapt (scrollable list, JSON detail view) |
| CSV exports (users, bookings, payments) | `pages/Exports.tsx` (blob download) | `GET /admin/exports/:kind` | adapt — download to `expo-file-system` + share/save instead of browser blob |
| Admin login | `pages/Login.tsx` | `POST /auth/login` (ADMIN role) | port |

## 4. Cross-cutting behaviour

| Behaviour | Web implementation | Mobile plan |
| --- | --- | --- |
| Theme: light/dark, `bmw-theme` key, system default | `packages/ui/src/theme.tsx` | port token-for-token; `Appearance` + stored preference |
| Status → badge tone maps (booking, listing, payment, verification) | `apps/*/src/lib/format.ts`, locked by `apps/admin/src/test/format.test.ts` | port the same maps + a mirrored unit test (cross-console contract) |
| Money in minor units (paise), `formatMoney` | `lib/format.ts`, `packages/shared-types/src/money.ts` | port; `Intl` works in Hermes |
| Pagination envelope `{ items, page, totalPages, … }` | `useAsyncData.ts` | TanStack `useInfiniteQuery` |
| Toasts, confirm dialogs | `components/Toast.tsx` | native toast + `Alert.alert` confirm |
| Skeletons / empty / error states | inline per page | shared `<Skeleton>`, `<EmptyState>`, `<ErrorState>` |
| Route guards + role redirect | `RouteGuard.tsx` ×3 | `useSession()` + Expo Router group guards |

## 5. Existing bugs found during audit (affecting mobile)

1. **None blocking.** The web apps were hardened in the passes recorded in `docs/PROGRESS.md`
   (production readiness, responsiveness, design consistency). Two deliberate web-only
   suppressions (`exhaustive-deps`, WCAG 2.5.8 inline links) do not carry over — React
   Native has no DOM deps lint context.
2. The partner `ListingForm` tests are slow under parallel load (>4 s) — the same risk applies
   to mobile typing tests; explicit timeouts are used.

## 6. Backend capabilities that do NOT exist (do not invent)

- Push notifications (no FCM/APNs registration endpoint or sender).
- Maps / geospatial queries (search filters are city-name text only).
- Offline sync or delta endpoints.
- Websockets (messages are polled).
- Any payment flow beyond Razorpay (web checkout.js) and the sandbox simulator.
- Rate-limit exemption or CORS change needed for mobile — non-browser clients are already
  allowed (`apps/api/src/app.ts:60-63`).
