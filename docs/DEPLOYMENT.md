# Production deployment runbook

End-to-end checklist for running BookMyWarehouse in production. The app is
wired for a single Vercel project (four services) with a shared domain, so
the API is same-origin (`/api/…`) and cookies work without CORS gymnastics.

---

## 1. Required environment (Vercel project → Settings → Environment Variables)

Set these for **Production** (and Preview if you use it):

| Variable | Value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Set by Vercel for the API service build/runtime. |
| `MONGODB_URI` | Atlas connection string for the **production** database | Use a dedicated DB (e.g. `bookmywarehouse_prod`), never the dev database. |
| `ACCESS_TOKEN_SECRET` | `openssl rand -hex 32` | **Required** — the API refuses to boot in production without it. |
| `REFRESH_TOKEN_SECRET` | `openssl rand -hex 32` | **Required**. |
| `SESSION_SECRET` | `openssl rand -hex 32` | **Required**. |
| `PAYMENT_WEBHOOK_SECRET` | `openssl rand -hex 32` | **Required** — the webhook route is authenticated solely by this HMAC secret. |
| `CUSTOMER_APP_URL` | `https://bookmywarehouse.vercel.app` | Used for links in emails + sitemap. |
| `PARTNER_APP_URL` | `https://bookmywarehouse.vercel.app/partner` | |
| `ADMIN_APP_URL` | `https://bookmywarehouse.vercel.app/admin` | |
| `CORS_ORIGINS` | `https://bookmywarehouse.vercel.app` | Comma-separated; localhost origins are only added when `NODE_ENV !== production`. |
| `API_BASE_URL` | `https://bookmywarehouse.vercel.app/api` | Absolute base for server-generated links. |

The frontends need **no** environment variables in production: they call the
relative `/api/v1` base (same origin), falling back to `localhost:4000` only
in dev.

### Optional integrations (each missing one logs a loud boot warning)

| Variable | Effect when set |
| --- | --- |
| `PAYMENT_PROVIDER=RAZORPAY` + `PAYMENT_PUBLIC_KEY` (key id `rzp_…`) + `PAYMENT_SECRET_KEY` | Live Razorpay checkout (see §3). Defaults to `SANDBOX` (simulated, clearly labeled in the UI). |
| `EMAIL_PROVIDER=resend` + `EMAIL_PROVIDER_API_KEY` + `EMAIL_FROM` | Transactional emails are actually delivered; otherwise they are logged. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Real image hosting; otherwise size-capped inline dev storage. |

Rate limits default to production-safe values (300/min API, 20 auth per
15 min/IP) — only override them for local/E2E runs.

## 2. Database + seeding

- Production seed creates **reference data only** (categories, platform
  settings) — no demo users, no sample listings:

  ```bash
  MONGODB_URI=<prod-uri> NODE_ENV=production pnpm --filter @bmw/api seed
  ```

- Bootstrap the first production admin through environment variables (never
  through seeded demo data):

  ```bash
  MONGODB_URI=<prod-uri> NODE_ENV=production \
  SEED_ADMIN_EMAIL=you@yourdomain.com SEED_ADMIN_PASSWORD='<strong password>' \
  pnpm --filter @bmw/api seed
  ```

- Demo accounts (`*@bookmywarehouse.dev`, `Demo@1234`) and sample listings are
  seeded **only** outside production, or when `SEED_DEMO=true` is set
  explicitly (demo/showcase environments). The seed is idempotent — re-running
  is safe.
- Rotating the Atlas `root:root` password and separating the dev database from
  production are one-time migration steps before go-live.

## 3. Razorpay (live payments)

1. Create a Razorpay account and complete KYC to get **standard live keys**.
2. Set `PAYMENT_PUBLIC_KEY` (key id), `PAYMENT_SECRET_KEY`, and a fresh
   `PAYMENT_WEBHOOK_SECRET`, and `PAYMENT_PROVIDER=RAZORPAY`.
3. In the Razorpay dashboard → Settings → Webhooks, add
   `https://bookmywarehouse.vercel.app/api/v1/payments/webhook` with events
   **payment.captured**, **payment.failed**, **refund.processed** and the same
   secret as `PAYMENT_WEBHOOK_SECRET`.
4. Flow: the customer clicks *Pay* → the API creates a Razorpay Order with the
   exact booking amount → Checkout.js opens hosted checkout → the handler
   payload is HMAC-verified server-side (`POST /api/v1/payments/verify`,
   idempotent) → signed webhooks drive booking confirmation, invoices and
   refunds. Cancellations push refunds through Razorpay's refund API and the
   `refund.processed` webhook completes the record.

Until the keys are configured, checkout runs in **sandbox** (simulated
end-to-end through the identical signed-webhook pipeline) — the UI labels it.

## 4. Email (Resend)

1. Verify your sending domain in Resend → get an API key → set
   `EMAIL_PROVIDER=resend`, `EMAIL_PROVIDER_API_KEY`, and a from-address on
   that domain (`EMAIL_FROM=BookMyWarehouse <no-reply@yourdomain.com>`).
2. Transactional emails fire (fire-and-forget, never blocking business logic)
   for booking requests/confirmations/cancellations, payment success/failure
   and refunds. With no provider configured, every email is logged instead.

## 5. Deploy

- Push to `main` → Vercel builds all four services (root `vercel.json`,
  committed entrypoints, no secrets in the repo) and the deployment goes live
  at `https://bookmywarehouse.vercel.app`.
- Sitemap/robots: `https://bookmywarehouse.vercel.app/robots.txt` (static) and
  `…/api/sitemap.xml` (DB-generated, cached 10 min).

## 6. Post-deploy smoke test

```bash
curl -s https://bookmywarehouse.vercel.app/health            # ok, db connected
curl -s -o /dev/null -w '%{http_code}\n' https://bookmywarehouse.vercel.app/          # customer
curl -s -o /dev/null -w '%{http_code}\n' https://bookmywarehouse.vercel.app/partner/  # partner
curl -s -o /dev/null -w '%{http_code}\n' https://bookmywarehouse.vercel.app/admin/    # admin
curl -s https://bookmywarehouse.vercel.app/api/sitemap.xml | head -5
```

Then: sign in with the seeded admin, register a real customer, publish a
listing as a partner (admin approval), and walk one booking end-to-end.

## 7. Security notes

- No secrets live in the repository (`.env*` files are untracked); rotate any
  token that has ever been pasted into a shell, issue, or chat.
- Auth secrets are ≥32 chars and required in production; the API refuses to
  boot without them (and without `PAYMENT_WEBHOOK_SECRET`).
- Passwords are hashed (bcrypt), tokens are short-lived JWTs with rotating
  refresh cookies (`HttpOnly`, `Secure`, `SameSite=Lax` in production),
  webhooks and checkout callbacks are HMAC-verified + idempotent, rate limits
  are on by default, and helmet/security headers are enabled.
