# BookMyWarehouse — Frontend ↔ API Reference

Single source of truth for the three frontend apps (customer 5173, partner 5174, admin 5175).
The API runs at **http://localhost:4000**, base path **`/api/v1`** (dev: `pnpm --filter @bmw/api dev`).

## 1. Response envelope

Success:

```json
{ "success": true, "data": <payload>, "meta": { "pagination": { "page": 1, "limit": 12, "total": 42, "totalPages": 4, "hasNextPage": true, "hasPreviousPage": false } }, "requestId": "uuid" }
```

Error:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "issues": [{ "path": "email", "message": "…" }] }, "requestId": "uuid" }
```

Common error codes: `VALIDATION_ERROR` (422, also `details.fields`), `UNAUTHENTICATED` (401),
`INVALID_CREDENTIALS` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT`/`EMAIL_TAKEN` (409),
`CAPACITY_UNAVAILABLE` (409), `PRECONDITION_FAILED` (412), `RATE_LIMITED` (429),
`PAYMENT_FAILED` (402), `PAYMENT_WEBHOOK_INVALID` (400), `ACCOUNT_SUSPENDED` (403),
`INVALID_STATE_TRANSITION` (409), `INTERNAL_ERROR` (500).

## 2. Auth model

- Access token: JWT returned as `data.accessToken` on register/login/refresh. Send as
  `Authorization: Bearer <token>` on every request.
- Refresh: httpOnly cookie `bmw_rt` (path `/api/v1/auth`) + readable cookie `bmw_csrf`.
  **Every non-GET request must send header `X-CSRF-Token: <value of bmw_csrf cookie>`** when that
  cookie exists (login/register/forgot/reset/verify and webhook are exempt).
- Refresh flow on 401: `POST /auth/refresh` with `credentials: 'include'` + CSRF header →
  new `{ user, accessToken, csrfToken }` → retry original request once → else logout.
- Keep access token in memory, persist in `localStorage` (`bmw_access_token`) for reloads;
  always confirm with `GET /auth/me` on boot.
- Cookies are set with `credentials: 'include'` — all fetches must use `credentials: 'include'`.
- Roles: `CUSTOMER`, `PARTNER`, `ADMIN` (uppercase). Register allows roles `CUSTOMER`/`PARTNER`
  only; an ADMIN account exists in the **dev/demo seed** (`admin@bookmywarehouse.dev` /
  `Demo@1234`) or is bootstrapped via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.

## 3. Shared conventions

- Money is **integer minor units** (paise). Display with
  `new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(minor / 100)`.
- Dates: ISO strings → `Intl.DateTimeFormat`/`toLocaleDateString`.
- Validation schemas live in `packages/validation/src/*.ts` (Zod v4) — read them for exact
  request shapes (e.g. `partnerOnboardingSchema`, `submitVerificationSchema`,
  `adminCustomerCreateSchema`, `createListingSchema`, `platformSettingsSchema`).
- DTO field definitions: `packages/shared-types/src/dto.ts`.
- Categories: `GET /catalog/categories` → `{ items: [{ id, name, slug, type, description, icon, imageUrl, parentId, listingCount, isActive, sortOrder }] }`.

## 4. Public catalog (no auth; `optionalAuth` personalizes)

| Endpoint | Notes |
| --- | --- |
| `GET /catalog/settings` | Platform settings: currency, fee percents, `allowSelfServiceListings`, `requirePartnerVerification`, `announcement`, `maintenanceMode`, `supportEmail`. |
| `GET /catalog/categories?type=WAREHOUSE\|EQUIPMENT\|SERVICE` | Category list. |
| `GET /catalog/categories/:slug` | Single category. |
| `GET /catalog/search` **and** `GET /catalog/listings` | Query: `page, limit, q, type, city, state, region, categoryId, facilityType, storageType, equipmentCategory, serviceType, minPrice, maxPrice, capacityMin, capacityMax, amenities, verifiedOnly, minRating, availableFrom, availableTo, lat, lng, radiusKm, sort` (`relevance\|newest\|price_asc\|price_desc\|rating_desc\|distance`). Response `data: { items: ListingSummary[], sort, facets, meta.pagination }`. |
| `GET /catalog/listings/:slug` | Full `ListingDetail` (summary fields + `description`, `rules`, `safetyFeatures`, `amenities`, `minBookingDuration`, `cancellationTerms`, `warehouse/equipment/service` details, `partner`, `availableFrom`, `views`). 404 unless `PUBLISHED`. |
| `GET /catalog/listings/:slugOrId/reviews` | `{ items: ReviewDTO[], average }` + pagination. Query `page, limit, minRating, sort(newest\|oldest\|rating_desc\|rating_asc)`. |
| `GET /catalog/listings/:id/availability` | `{ rules: [{ id, daysOfWeek, startTime, endTime, startDate, endDate }], blockedDates: [{ id, date, reason, isAvailable }] }`. |
| `GET /catalog/listings/:slug/similar` | `{ items: ListingSummary[] }` (max 4). |

Crawler endpoints (no auth, no rate limit; registered on both `/` and `/api/` prefixes):

| Endpoint | Notes |
| --- | --- |
| `GET /sitemap.xml` / `GET /api/sitemap.xml` | XML urlset: home, search, categories, every `PUBLISHED` listing (`{CUSTOMER_APP_URL}/listing/{slug}`, `lastmod` = updatedAt). In-memory cache 10 min. On Vercel use `/api/sitemap.xml` (declared by `robots.txt`). |
| `GET /robots.txt` / `GET /api/robots.txt` | `Allow: /`, `Disallow: /admin/ /partner/`, `Sitemap:` line. A static `robots.txt` in `apps/customer/public/` also ships and wins on the filesystem. |

`ListingSummary`: `{ id, type, title, slug, status, categoryId, categoryName, location, city, state, price: { model, amount, currency, period, unitLabel, minQuantity, additionalCharges }, totalCapacity, capacityUnit, rating: { average, count }, coverImage, images, partner: { userId, businessName, verificationStatus }, availableFrom, isFavorite, createdAt, publishedAt }`.
`price.amount` is **minor units**.

## 5. Bookings

| Endpoint | Notes |
| --- | --- |
| `POST /bookings/quote` | Public. Body `{ listingId, startDate, endDate?, capacity?, quantity?, deliveryRequired?, operatorRequired? }` → `{ listingId, currency, pricing: { currency, subtotal, platformFee, taxes, discount, total, breakdown: [{label, amount}], rateDescription } \| null, available, unavailableReason, remainingCapacity, startDate, endDate }`. |
| `POST /bookings` | Auth. Same body + `notes?, specialRequirements?` → 201 `BookingDTO` (status `PENDING_APPROVAL`). 409 `CAPACITY_UNAVAILABLE` when over capacity. |
| `GET /bookings?status=&type=&q=&page=&limit=&scope=admin` | Role-scoped automatically (customer/partner/admin). `{ items: BookingDTO[] }` + pagination. |
| `GET /bookings/:id` | `BookingDTO`. 403/404 for unrelated users. |
| `POST /bookings/:id/accept` | Partner/admin → `AWAITING_PAYMENT` (or `CONFIRMED` if total is 0). |
| `POST /bookings/:id/reject` | Body `{ reason }` (partner/admin). |
| `POST /bookings/:id/start` | Partner/admin → `IN_PROGRESS`. |
| `POST /bookings/:id/complete` | Partner/admin; body `{ note? }`. |
| `POST /bookings/:id/cancel` | Body `{ reason }`; returns `{ booking, refundAmountMinor }`. |
| `POST /bookings/:id/dispute` | Body `{ bookingId, reason, description }` (reasons: `SERVICE_NOT_DELIVERED, QUALITY_ISSUE, OVERCHARGE, CANCELLATION_REFUND, DAMAGE, OTHER`). |

`BookingDTO`: `{ id, reference, type, status, listing: { id, title, slug, type, coverImage, city }, customer: { id, name, avatarUrl }, partner: { id, businessName, verified }, startDate, endDate, requestedCapacity, capacityUnit, quantity, notes, specialRequirements, pricing: { currency, subtotal, platformFee, taxes, discount, total, breakdown, rateDescription }, items, statusHistory: [{ status, at, byRole, note }], payment?, review?, createdAt, updatedAt }` (see `dto.ts` for the full type).

Status machine: `DRAFT → PENDING_APPROVAL → AWAITING_PAYMENT → CONFIRMED → IN_PROGRESS → COMPLETED`,
with branches `REJECTED`, `CANCELLED`, `REFUND_PENDING`, `REFUNDED`, `DISPUTED`.

## 6. Payments & invoices

| Endpoint | Notes |
| --- | --- |
| `GET /payments/config` | Auth. Public checkout config: `{ provider: 'SANDBOX'\|'RAZORPAY'\|'STRIPE', sandbox: boolean, razorpayKeyId: string \| null }` — never secrets. |
| `POST /payments/bookings/:bookingId/initiate` | → `{ payment: { id, reference, amount, currency, status, provider }, checkoutUrl, sandbox, razorpay: { orderId } \| null, message }`. With `PAYMENT_PROVIDER=RAZORPAY` the `razorpay.orderId` is opened via Checkout.js. |
| `POST /payments/verify` | Razorpay only. `{ orderId, paymentId, signature }` — HMAC-verified Checkout.js handler payload (64-char hex); idempotent (`alreadyProcessed` on replay). 412 `PRECONDITION_FAILED` when the provider isn't checkout-verifiable; 400 `PAYMENT_WEBHOOK_INVALID` on signature mismatch. |
| `POST /payments/simulate` | Sandbox only. `{ paymentId, outcome: 'SUCCESS' \| 'FAILURE' }` → drives the webhook (booking → `CONFIRMED`). |
| `POST /payments/webhook` | Gateway-facing (HMAC-signed raw body, `x-razorpay-signature` or `x-payments-signature`); idempotent by event id. |
| `GET /payments` | Customer payment history `{ items: [{ id, bookingId, reference, amount, currency, status, provider, paidAt, createdAt }] }`. |
| `GET /payments/invoices?page=&limit=` | Own invoices `{ items: InvoiceDTO[] }`. |
| `GET /payments/invoices/:id` | `InvoiceDTO`: `{ id, invoiceNumber, bookingId, bookingReference, status, issuedTo, issuedBy, lineItems: [{description, quantity, unitAmount, amount}], subtotal, platformFee, taxes, total, … }`. Admin can view any; others get 4xx. |
| `GET /payments/invoices/:id/html` | Renders invoice HTML (open in new tab / print). |

## 7. Social / me endpoints (any authenticated user, mounted at `/api/v1`)

| Endpoint | Notes |
| --- | --- |
| `GET /me` / `PATCH /me` | Same payload as `/auth/me`; PATCH body `{ name?, phone?, avatarUrl? }`. |
| `POST /uploads` | `{ file: '<data URI>', folder: 'listings'\|'avatars'\|'documents'\|'logos' }` → `{ url }` (inline dev storage). |
| `POST /reviews` | `{ bookingId, rating: 1-5, comment? }` → 201 `{ id }`. Only booking owner, only `COMPLETED` bookings (412 otherwise), one per booking (409). |
| `POST /reviews/:id/respond` | `{ text }` — partner of the listing. |
| `GET /me/reviews?page=&limit=` | Own reviews (partner role → reviews of their listings + `average`). |
| `GET /favorites` / `POST /favorites` | List; toggle body `{ listingId }` → `{ active: boolean }`-ish result. |
| `GET /notifications?page=&limit=&unreadOnly` | `{ unread, items: [{ id, type, title, body, link, read, createdAt }] }`. |
| `POST /notifications/read` | `{ ids?: string[] }` (no ids → mark all read). |
| `GET/POST /conversations` | List `{ items, unreadTotal }`; create `{ listingId?, toUserId?, subject, body }` → `{ conversationId, messageId }`. |
| `GET /conversations/:id/messages?page=&limit=` | `{ items }`. |
| `POST /conversations/:id/messages` | `{ body }` → 201 message. |
| `POST /conversations/:id/read` | `{ ids? }`. |
| `GET /disputes` | `{ items, total }` — disputes raised by the current user. |

## 8. Partner API (`/api/v1/partner`, role `PARTNER` or `ADMIN`)

| Endpoint | Notes |
| --- | --- |
| `GET /partner/profile` | Serialized partner profile (business info, verification, payout details masked). |
| `POST /partner/onboarding` | `partnerOnboardingSchema` (business name/type/description/address/supportedTypes/website…). |
| `POST /partner/verification` | `submitVerificationSchema` (legal name, GST/PAN, documents[]). |
| `PATCH /partner/payout-details` | `payoutDetailsSchema` (account number stored masked). |
| `GET /partner/dashboard` | `{ verificationStatus, totals: { activeListings, draftListings, pendingRequests, confirmedBookings, completedBookings, cancelledBookings, unreadMessages, averageRating, reviewCount }, revenue: { currency, totalEarned, pendingPayout, last30Days }, responseRate, trends: [{ date, bookings, grossAmount }] }`. |
| `GET /partner/earnings?page=&limit=` | Earnings list + pagination. |
| `GET /partner/listings?status=&type=&q=&page=&limit=` | Own listings `{ items }` + pagination. |
| `POST /partner/listings` | `createListingSchema` (type-specific `warehouse/equipment/service`, images: https/data-URI, price in major units, `categoryId`) → 201 `{ id, slug, status }`. |
| `GET/PATCH/DELETE /partner/listings/:id` | Detail (full), update (`updateListingSchema`), soft delete. |
| `POST /partner/listings/:id/publish\|unpublish\|archive` | Publish → `PENDING_REVIEW` (admin approves). |
| `GET /partner/listings/:id/availability` | Rules + blocked dates. |
| `POST /partner/availability-rules` / `DELETE /partner/availability-rules/:id` | `availabilityRuleSchema` — `{ listingId, daysOfWeek: 0-6[], startTime:'HH:mm', endTime:'HH:mm', startDate?, endDate? }`. |
| `POST /partner/availability-exceptions` / `DELETE /partner/availability-exceptions/:id` | `{ listingId, date, reason?, isAvailable }` (`false` blocks the day). |

Partner booking actions use the shared `/bookings` endpoints (scope is automatic).
Partner reviews use `/me/reviews` + `/reviews/:id/respond`.

## 9. Admin API (`/api/v1/admin`, role `ADMIN`)

All list endpoints accept `page, limit, q` (+ filters below) and return `{ items }` + `meta.pagination`.

| Endpoint | Notes |
| --- | --- |
| `GET /admin/dashboard` | `{ totals: { customers, partners, verifiedPartners, listings, activeListings, bookings, pendingBookings, disputesOpen, pendingVerifications, pendingListings }, revenue: { currency, grossCollected, platformFees, refunds, netCollected, periodDays }, trends: [{ date, bookings, grossAmount }], recentBookings: [...] }`. |
| `GET /admin/users?role=&status=` | User list (`{ id, email, name, role, phone, avatarUrl, emailVerified, status, createdAt }`). |
| `POST /admin/users` | `adminCustomerCreateSchema` → 201. |
| `PATCH /admin/users/:id` | `{ action: 'SUSPEND'\|'REACTIVATE'\|'DEACTIVATE', reason? }`. |
| `GET /admin/partners?verificationStatus=` / `GET /admin/partners/:id` | Partner lists/detail. |
| `POST /admin/partners/:id/decision` | `{ decision: 'APPROVE'\|'REJECT'\|'SUSPEND', reason?, notes? }` (KYC approval). |
| `GET /admin/verification-queue?status=SUBMITTED` | KYC queue. |
| `GET /admin/listings?status=&type=` | All listings. |
| `PATCH /admin/listings/:id` | `{ decision: 'APPROVE'\|'REJECT'\|'SUSPEND'\|'UNSUSPEND', reason? }`. |
| `GET /admin/payments?status=` / `GET /admin/refunds?status=` / `POST /admin/refunds/:id/process` | Finance ops. |
| `GET /admin/invoices` | All invoices. |
| `GET /admin/disputes?status=` / `POST /admin/disputes/:id/resolve` | `{ resolution: 'RESOLVED_CUSTOMER'\|'RESOLVED_PARTNER'\|'CLOSED', resolutionNote, refundAmount? }`. |
| `GET /admin/categories?includeInactive=true` / `POST` / `PATCH /:id` | `categorySchema`. |
| `GET /admin/reviews` / `POST /admin/reviews/:id/moderate` | `{ status: 'PUBLISHED'\|'HIDDEN'\|'REMOVED', note? }`. |
| `GET /admin/settings` / `PATCH /admin/settings` | `platformSettingsSchema`. |
| `GET /admin/audit-logs?action=&entityType=&entityId=&page=&limit=` | Audit trail items: `{ id, actor…, action, entityType, entityId, summary, ip, createdAt }` (check serializer for exact fields). |
| `GET /admin/exports/bookings.csv` / `GET /admin/exports/payouts.csv` | Accounting CSVs (UTF-8 BOM, CRLF, RFC4180 escaping, ≤5000 rows, `Content-Disposition` attachment). Audited as `admin.export`. |

## 10. Seed / demo accounts (dev)

Demo content (accounts, listings, bookings) seeds on every run **outside production**, or when
`SEED_DEMO=true` is set explicitly. Production seeding (`NODE_ENV=production`) creates reference
data only — categories + platform settings — plus an admin bootstrap when
`SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` (≥12 chars) are set. See `docs/DEPLOYMENT.md`.

Password for all demo accounts: `Demo@1234`

- `admin@bookmywarehouse.dev` (ADMIN)
- `partner@bookmywarehouse.dev` (PARTNER, VERIFIED, listings + earnings data)
- `partner2@bookmywarehouse.dev` (PARTNER, KYC `SUBMITTED` — appears in admin queue)
- `customer@bookmywarehouse.dev` (CUSTOMER, bookings incl. confirmed + completed + review)

## 11. Frontend conventions (all three apps)

- Vite + React 18 + TS (`moduleResolution: Bundler`), `react-router-dom` v6, **no external UI
  component libraries** — a shared in-repo kit `@bmw/ui` (`packages/ui`: shadcn-style
  primitives, `ThemeProvider`/`ThemeToggle`, Motion variants) on Tailwind v4, with one
  token source `packages/ui/src/tokens.css` layered over each app's handwritten CSS.
  Brand: electric blue (`#2563eb`) with deep-navy ink, crisp neutrals and a teal accent;
  light/dark/system themes via `[data-theme]`.
- Env: `VITE_API_URL` (default `http://localhost:4000/api/v1`).
- One shared-per-app `api.ts` fetch wrapper implementing §1–2 (envelope unwrap, CSRF header,
  auto-refresh-once on 401, typed errors).
- Auth context: `user`, `loading`, `login/register/logout/refreshUser`; route guards by role that
  redirect to the app's own login page.
- Show `error.message` to users; render `issues[]` inline on forms.
- Loading skeletons/empty states matter; every list handles `meta.pagination`.
- Tests: vitest + @testing-library/react (jsdom). Add `vitest.config.ts` (environment jsdom,
  setupFiles `src/test/setup.ts` importing `@testing-library/jest-dom`) and cover important
  forms/filters/guards. `pnpm --filter @bmw/<app> test` must pass.
