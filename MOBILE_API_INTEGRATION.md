# BookMyWarehouse — Mobile API Integration

The contract the mobile client is built against, extracted from
`apps/api/src/app.ts`, `apps/api/src/routes/*`, `apps/api/src/middleware/*` and the
generated OpenAPI spec (`GET /api/v1/openapi.json`, live). Every statement here was read from
source, not inferred from the deployed site.

---

## 1. Base URL and configuration

| Env | Base URL |
| --- | --- |
| production | `https://bookmywarehouse.vercel.app/api/v1` (verified: `GET /health` → `{success:true,…}`, `GET /api/v1/openapi.json` → 200) |
| dev (Android emulator) | `http://10.0.2.2:4000/api/v1` |
| dev (iOS simulator) | `http://localhost:4000/api/v1` |
| dev (device on LAN) | `http://<host-ip>:4000/api/v1` |

Read from `EXPO_PUBLIC_API_URL`. Health check for startup/connectivity gating:
`GET {origin}/health` (note: **not** under `/api/v1`).

`GET /api/v1/auth/bootstrap` (public) returns client app URLs and the email-provider mode —
usable by the app to detect misconfiguration at runtime.

## 2. Envelopes

Success (`apps/api/src/lib/respond.ts`):

```jsonc
{ "success": true, "data": { /* resource or { items: [...], page, … } */ },
  "meta": { /* optional: pagination, … */ }, "requestId": "…" }
```

Error:

```jsonc
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…",
    "issues": [ { "path": "email", "message": "…" } ] }, "requestId": "…" }
```

Codes seen in source: `BAD_REQUEST`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `FORBIDDEN`,
`NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED`, `VALIDATION_ERROR`, `RATE_LIMITED`,
`PAYMENT_FAILED`, `INTERNAL_ERROR` (status→code fallback table in
`apps/customer/src/lib/api.ts:149`).

**Pagination:** query `page` (1-based) + `limit`; response `data.items` plus
`meta.pagination` (`page`, `limit`, `totalItems`, `totalPages`). Default limit 20, max 100.
The mobile client mirrors this exactly.

## 3. Authentication

### 3.1 Flow

| Step | Request | Response |
| --- | --- | --- |
| Login | `POST /auth/login` `{ email, password }` | body `{ user, accessToken, csrfToken }`; `Set-Cookie: bmw_rt=…; HttpOnly; Path=/api/v1/auth` (30 d) and `bmw_csrf=…; Path=/` (readable) |
| Register | `POST /auth/register` `{ fullName, email, password, phone?, role: "CUSTOMER"\|"PARTNER", acceptTerms }` | same shape as login |
| Me | `GET /auth/me` (Bearer) | `{ user }` |
| Refresh | `POST /auth/refresh` — **must** carry `Cookie: bmw_rt=…`; when `bmw_csrf` cookie is present, also `X-CSRF-Token` | new `{ accessToken, csrfToken }` + rotated cookies |
| Logout | `POST /auth/logout` — carries `bmw_rt` + `X-CSRF-Token` | 200, cookies cleared; server revokes the session |
| Forgot / reset | `POST /auth/forgot-password` `{ email }`; `POST /auth/reset-password` `{ token, password }` | token delivered by email link |
| Verify email | `POST /auth/verify-email` `{ token }` | |
| Change password | `POST /auth/change-password` `{ currentPassword, newPassword }` (Bearer) | |

Access token TTL 15 min (`ACCESS_TOKEN_TTL`); refresh 30 d with **rotation + reuse detection**:
using a rotated-out cookie revokes the whole session family (`apps/api/src/services/token.service.ts`).

### 3.2 Mobile-specific session handling (the critical adaptation)

React Native's `fetch` does not persist cookies, and the API's refresh endpoint reads the
refresh token **only** from the `bmw_rt` cookie. The mobile client therefore:

1. At login/register/refresh, parses `Set-Cookie` from the response and stores
   `bmw_rt` + `bmw_csrf` in `expo-secure-store` (Keychain/Keystore), alongside the
   `accessToken`/`csrfToken` from the body.
2. Sends **no cookies at all** on ordinary API calls — only
   `Authorization: Bearer <accessToken>`. The CSRF middleware skips pure-Bearer clients
   entirely (`apps/api/src/middleware/csrf.ts:42`), so no `X-CSRF-Token` is needed for
   normal requests.
3. On `/auth/refresh` and `/auth/logout` only, replays
   `Cookie: bmw_rt=…; bmw_csrf=…` + `X-CSRF-Token: <csrf>` — the same double-submit the
   browser performs.
4. On `401` (code `TOKEN_EXPIRED`/`UNAUTHENTICATED`) from a non-auth route: one
   single-flight refresh attempt, replay the original request once, else clear the session
   and emit an unauthorized event (the app redirects to login).
5. Session restore on cold start: read stored access token → `GET /auth/me`; if expired →
   refresh first.

No server change is required or made. This mirrors `apps/customer/src/lib/api.ts` minus the
DOM (`credentials:'include'`, `document.cookie`, `localStorage`).

**Reuse detection caveat:** the client stores the *current* rotated cookie value after every
refresh, so a stale value is never replayed. Multiple devices each get their own session
family (per `sid`), which is how the web app behaves too.

## 4. Rate limiting (client must handle 429)

| Group | Limit |
| --- | --- |
| All `/api/*` | 300 req / 15 min per IP |
| Auth credentials (`register`, `login`, `forgot`, `reset`) | 20 / 15 min |
| Sensitive (change-password, uploads, payment initiate, verification submit) | 10 / 15 min |

Response `429` + `Retry-After` seconds header. Mobile backs off on 429 (respect
`Retry-After`, surface a friendly message, never auto-retry auth endpoints).

## 5. Endpoint map used by the mobile client

Mount point `/api/v1`. "Auth" column: **pub** public · **b** optional auth · **a** Bearer ·
**r(a)** role-allowed. Full list: `GET /api/v1/openapi.json`.

### Catalog (public discovery)
| Method + path | Auth | Notes |
| --- | --- | --- |
| `GET /catalog/search` | b | `q,type,city,minPrice,maxPrice,capacityMin,amenities,verifiedOnly,minRating,categoryId,sort,page,limit` |
| `GET /catalog/listings/:slug` | b | detail DTO |
| `GET /catalog/listings/:slug/availability` | b | date-ranged availability |
| `GET /catalog/categories` | pub | tree |
| `GET /catalog/cities` | pub | distinct city list |
| `POST /inquiries` | pub(+a) | anonymous inquiry; logged-in attaches user |

### Bookings & payments (customer)
| Method + path | Auth | Notes |
| --- | --- | --- |
| `POST /bookings/quote` | a | price preview incl. taxes/fees |
| `POST /bookings` | a | create; body validated by `createBookingSchema` |
| `GET /bookings` · `GET /bookings/:id` | a | `items` envelope |
| `POST /bookings/:id/cancel` | a | state machine enforced server-side |
| `GET /payments/config` | a | `{ sandbox, provider }` |
| `POST /payments/initiate` · `POST /payments/simulate` · `GET /payments/:id/status` | a | `simulate` only when `sandbox:true` |
| `GET /payments/invoices` · `GET /payments/invoices/:id` · `…/:id/html` | a | `html` for print |

Booking statuses: `PENDING, CONFIRMED, ACTIVE, COMPLETED, CANCELLED, REJECTED, DISPUTED`;
payment: `CREATED, AUTHORIZED, CAPTURED, FAILED, REFUNDED, PARTIALLY_REFUNDED`.
Transition actions map 1:1 to endpoints — never guessed client-side.

### Account
`GET/POST/DELETE /favorites` · `GET/POST /reviews` · `GET /conversations`,
`GET /conversations/:id/messages`, `POST /conversations/:id/messages`,
`POST /conversations/:id/read` · `GET /notifications`, `PATCH /notifications/:id`,
`POST /notifications/read-all` · `GET/POST /disputes` · `GET/PATCH /users/me`,
`POST /auth/change-password` (all **a**).

### Partner (`r(PARTNER, ADMIN)`)
`GET /partner/dashboard` · `GET/PATCH /partner/profile` · `GET /partner/listings`,
`POST /partner/listings`, `PATCH /partner/listings/:id`, `DELETE …`,
`POST /partner/listings/:id/{publish,unpublish,archive}` ·
`GET/POST/DELETE /partner/listings/:id/availability` ·
`GET /partner/bookings`, `POST /partner/bookings/:id/{confirm,start,complete,cancel}` ·
`GET /partner/earnings`, `GET /partner/payouts` ·
`GET /partner/reviews`, `POST /reviews/:id/response` ·
`GET /partner/verification`, `POST /partner/verification/submit`.

### Admin (`r(ADMIN)`)
`GET /admin/dashboard` · `GET /admin/users`, `PATCH /admin/users/:id/status` ·
`GET /admin/partners`, `GET /admin/partners/:id` ·
`GET /admin/verifications`, `POST /admin/verifications/:id/{approve,reject}` ·
`GET /admin/listings`, `POST /admin/listings/:id/{approve,reject,suspend,restore}` ·
`GET /admin/bookings`, `POST /admin/bookings/:id/refund` ·
`GET /admin/payments`, `POST /admin/payments/:id/retry-webhook` ·
`GET /admin/refunds`, `POST /admin/refunds/:id/{process,void}` ·
`GET /admin/invoices` (+ `:id`) · `GET /admin/disputes`, `POST /admin/disputes/:id/resolve` ·
`GET/POST/PATCH/DELETE /admin/categories` · `GET /admin/reviews`, `DELETE /admin/reviews/:id` ·
`GET/PATCH /admin/settings` · `GET /admin/audit-logs` · `GET /admin/exports/:kind` (CSV text).

### Uploads
`POST /uploads` (**a**, sensitive limiter): JSON body
`{ "file": { "buffer": <base64>, "mimetype": "image/jpeg", "originalname": "a.jpg" } }` →
`{ url, publicId, width, height, bytes, format }`. Allowed: jpeg/png/webp/gif; ≤ 2 MB body;
dev stores inline (≤ 400 KB), production uploads to Cloudinary. Mobile compresses via
`expo-image-manipulator` to stay under the cap.

### Misc
`GET /health` (root, not `/api/v1`) · `GET /api/v1/docs`, `GET /api/v1/openapi.json` ·
sitemap/robots · `POST /api/v1/payments/webhook` (server-to-server only; **never** called by
the client).

## 6. Validation

Request bodies are validated by `@bmw/validation` (Zod v4) server-side. The mobile app
imports **the same schemas** for client-side validation (RHF `zodResolver`), so messages and
rules cannot drift: `loginSchema`, `registerSchema`, `forgotPasswordSchema`,
`resetPasswordSchema`, `changePasswordSchema`, `createBookingSchema`, `createInquirySchema`,
`createReviewSchema`, `createDisputeSchema`, `updateProfileSchema`, partner listing/onboarding
schemas, admin schemas. Query schemas (`paginationSchema`, `searchQuerySchema`) shape list
requests.

## 7. Conventions the client follows

- Money is **integer minor units** (paise); never floats. `formatMoney` ported from
  `apps/customer/src/lib/format.ts`.
- IDs are 24-char hex strings; `shortenId(id, 8)` for display.
- All list endpoints return `{ items, … }` inside `data`; unwrap centrally.
- Errors always → typed `ApiError { status, code, message, issues[] }` with
  `issueFor(path)` for form mapping.
- Every request has a timeout (15 s default) + caller-provided `AbortSignal`; TanStack
  Query owns retries (none on 4xx, 2× exponential on network/5xx for GET).
- Tokens/secrets never logged; no `console.log` of payloads in release builds.

## 8. Known gaps, blockers and follow-ups (honest list)

| Item | State |
| --- | --- |
| iOS build/test | **Blocked** — Linux host, no macOS/Xcode. Code is cross-platform; no iOS claims made. |
| Android emulator | Attempted on this host (KVM available; `/opt/android-sdk` has cmdline-tools only). If the system image does not fit available disk, documented rather than faked. |
| Live Razorpay checkout | Follow-up — needs `react-native-razorpay` (native module, dev build) + live keys. SANDBOX flow is fully implemented and is the backend default. |
| Push notifications | Not implemented — no backend. In-app notifications screen is the source of truth. |
| Maps | Not implemented — backend has no geo search; would invent a feature. |
| Websockets for chat | None server-side; messages poll (15 s) with manual refresh. |
| Deep links for password reset | App registers `/reset-password` + `/verify-email` routes; if the email links point at the web domain, the in-app "paste token" fallback covers it. |
