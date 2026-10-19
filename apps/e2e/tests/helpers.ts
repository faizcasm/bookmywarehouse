/**
 * Shared fixtures/helpers for the BookMyWarehouse Playwright suite.
 *
 * Two kinds of sessions are provided:
 *  - UI sessions (`openApp`) drive the three Vite frontends (5173/5174/5175).
 *    Successful logins are cached to `apps/e2e/.auth/*.json` so repeated runs
 *    reuse the refresh cookie instead of burning the API's auth rate limit
 *    (POST /auth/login is limited to 20 requests / 15 min per IP).
 *  - API sessions (`apiLogin` / `apiRegister`) drive `APIRequestContext`s with
 *    bearer tokens and the double-submit CSRF header exactly like lib/api.ts.
 */
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

export const APPS = {
  customer: 'http://localhost:5173',
  partner: 'http://localhost:5174',
  admin: 'http://localhost:5175',
} as const;

export type AppName = keyof typeof APPS;

export const API_BASE = 'http://localhost:4000/api/v1';

/**
 * Absolute URL for an API path. Playwright resolves request paths with
 * `new URL(path, baseURL)`, so a leading slash would drop the `/api/v1`
 * prefix — always ask for the full URL instead.
 */
export function apiUrl(path: string): string {
  return `${API_BASE}/${path.replace(/^\/+/, '')}`;
}
export const DEMO_PASSWORD = 'Demo@1234';
export const DEMO = {
  admin: 'admin@bookmywarehouse.dev',
  partner: 'partner@bookmywarehouse.dev',
  partner2: 'partner2@bookmywarehouse.dev',
  customer: 'customer@bookmywarehouse.dev',
} as const;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const AUTH_DIR = path.join(HERE, '..', '.auth');
const ROOT_ENV_PATH = path.join(REPO_ROOT, '.env');

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

let uniqueCounter = 0;

/** Timestamp+counter+random id — unique enough for parallel-safe emails/slugs. */
export function uniqueId(): string {
  uniqueCounter += 1;
  return `${Date.now().toString(36)}-${uniqueCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${uniqueId()}@e2e.test`;
}

/** YYYY-MM-DD `days` from now (UTC), as used by the API's date coercion. */
export function isoDaysOut(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * A booking window at least `minDays` out whose every day satisfies the
 * seeded availability rule on the demo warehouse (daysOfWeek 1–6, i.e. no
 * Sundays). Fresh listings have no rules, so this is safe everywhere.
 */
export function bookingWindow(minDays = 60, spanDays = 3): { start: string; end: string } {
  const cursor = new Date(Date.now() + minDays * 24 * 60 * 60 * 1000);
  cursor.setUTCHours(0, 0, 0, 0);
  for (let guard = 0; guard < 14; guard += 1) {
    let hitsSunday = false;
    for (let day = 0; day <= spanDays; day += 1) {
      if (new Date(cursor.getTime() + day * 24 * 60 * 60 * 1000).getUTCDay() === 0) hitsSunday = true;
    }
    if (!hitsSunday) break;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const start = cursor.toISOString().slice(0, 10);
  return { start, end: addDays(start, spanDays) };
}

export interface Envelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string; issues?: { path?: string; message?: string }[] };
  requestId?: string;
}

export function envelopeOf<T>(res: APIResponse): Promise<Envelope<T>> {
  return res.json() as Promise<Envelope<T>>;
}

/* ------------------------------------------------------------------ */
/* Webhook signing (mirrors apps/api/src/services/payment.service.ts)  */
/* ------------------------------------------------------------------ */

function readRootEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(ROOT_ENV_PATH)) return out;
  for (const line of readFileSync(ROOT_ENV_PATH, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && match[1]) out[match[1]] = match[2];
  }
  return out;
}

/** HMAC-SHA256 signature the sandbox provider expects on `POST /payments/webhook`. */
export function signWebhook(rawBody: string): string {
  const secret =
    process.env.PAYMENT_WEBHOOK_SECRET ??
    readRootEnv().PAYMENT_WEBHOOK_SECRET ??
    // Same insecure development fallback the API uses when the env var is absent.
    'dev-insecure-webhook-replace-before-production-000000000000000';
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/* ------------------------------------------------------------------ */
/* API sessions (Playwright request contexts)                          */
/* ------------------------------------------------------------------ */

export interface ApiSession {
  ctx: APIRequestContext;
  token: string;
  email?: string;
}

export function publicApi(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: API_BASE });
}

async function readCsrf(ctx: APIRequestContext): Promise<string | null> {
  const state = await ctx.storageState();
  return state.cookies.find((cookie) => cookie.name === 'bmw_csrf')?.value ?? null;
}

/**
 * Single request helper: bearer token + `X-CSRF-Token` double-submit for
 * non-GET requests (exactly what the frontends' lib/api.ts does).
 */
export async function apiCall<T = unknown>(
  session: ApiSession,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  data?: unknown,
): Promise<{ res: APIResponse; body: Envelope<T> }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${session.token}` };
  if (method !== 'GET') {
    const csrf = await readCsrf(session.ctx);
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  const res = await session.ctx.fetch(apiUrl(path), {
    method,
    headers,
    ...(data !== undefined ? { data } : {}),
  });
  const body = (await res.json().catch(() => ({}))) as Envelope<T>;
  return { res, body };
}

/** `apiCall` + assert the envelope succeeded; returns `data`. */
export async function apiJson<T = unknown>(
  session: ApiSession,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  data?: unknown,
): Promise<T> {
  const { res, body } = await apiCall<T>(session, method, path, data);
  expect(
    res.ok() && body.success !== false,
    `${method} ${path} → ${res.status()} ${JSON.stringify(body).slice(0, 500)}`,
  ).toBe(true);
  return body.data as T;
}

export async function apiLogin(email: string, password: string = DEMO_PASSWORD): Promise<ApiSession> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  const res = await ctx.post(apiUrl('/auth/login'), { data: { email, password } });
  const body = (await res.json().catch(() => ({}))) as Envelope<{ accessToken: string }>;
  expect(res.ok(), `login ${email} → ${res.status()} ${JSON.stringify(body)}`).toBe(true);
  return { ctx, token: body.data?.accessToken as string, email };
}

export async function apiRegister(
  email: string,
  options: {
    password?: string;
    role?: 'CUSTOMER' | 'PARTNER';
    name?: string;
    businessName?: string;
  } = {},
): Promise<ApiSession> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  const res = await ctx.post(apiUrl('/auth/register'), {
    data: {
      name: options.name ?? `E2E ${uniqueId()}`,
      email,
      password: options.password ?? DEMO_PASSWORD,
      role: options.role ?? 'CUSTOMER',
      ...(options.businessName ? { businessName: options.businessName } : {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Envelope<{ accessToken: string }>;
  expect(res.ok(), `register ${email} → ${res.status()} ${JSON.stringify(body)}`).toBe(true);
  return { ctx, token: body.data?.accessToken as string, email };
}

/** Token currently held by a UI session (in-memory/localStorage mirror). */
export function uiAccessToken(page: Page): Promise<string> {
  return page.evaluate(() => window.localStorage.getItem('bmw_access_token') ?? '');
}

/**
 * API session around a token that was issued elsewhere (e.g. extracted from a
 * logged-in UI page). The context carries no cookies, so the CSRF middleware
 * sees no ambient credential and accepts plain bearer requests.
 */
export async function sessionFromToken(token: string): Promise<ApiSession> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  expect(token, 'expected a non-empty access token').toBeTruthy();
  return { ctx, token };
}

/** Reads a field from `GET /auth/me`-style profile endpoints inside a UI page. */
export async function fetchApiField(page: Page, path: string, field: string): Promise<unknown> {
  return page.evaluate(
    async ([apiBase, reqPath, reqField]) => {
      const token = window.localStorage.getItem('bmw_access_token');
      const res = await fetch(`${apiBase}${reqPath}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = (await res.json().catch(() => null)) as { data?: Record<string, unknown> } | null;
      return body?.data?.[reqField] ?? null;
    },
    [API_BASE, path, field] as [string, string, string],
  );
}

/* ------------------------------------------------------------------ */
/* UI sessions                                                         */
/* ------------------------------------------------------------------ */

export interface UiSession {
  context: BrowserContext;
  page: Page;
  email: string;
}

function authStatePath(app: AppName, email: string): string {
  const safe = email.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(AUTH_DIR, `${app}-${safe}.json`);
}

export async function uiLogin(
  page: Page,
  app: AppName,
  email: string,
  password: string = DEMO_PASSWORD,
): Promise<void> {
  await page.goto(`${APPS[app]}/login`);
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  // Scope to the login form — the shared header ships its own search form.
  await page.locator('form:has(#login-password) button[type="submit"]').click();
  await expect(page, `expected ${email} to land past /login on the ${app} app`).not.toHaveURL(/\/login/, {
    timeout: 30_000,
  });
}

/**
 * Mirrors lib/api.ts session bootstrap: valid access token → true, otherwise
 * try the cookie refresh once. Consumes at most one rate-limited
 * `POST /auth/refresh` per call (only when the cached token expired).
 */
async function sessionUsable(page: Page): Promise<boolean> {
  return page.evaluate(async (apiBase) => {
    const token = window.localStorage.getItem('bmw_access_token');
    if (!token) return false;
    const me = await fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (me.ok) return true;
    const csrfMatch = document.cookie.match(/(?:^|;\s*)bmw_csrf=([^;]*)/);
    const refresh = await fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfMatch?.[1] ? { 'X-CSRF-Token': decodeURIComponent(csrfMatch[1]) } : {},
    });
    if (!refresh.ok) return false;
    const payload = (await refresh.json()) as { success?: boolean; data?: { accessToken?: string } };
    const next = payload?.data?.accessToken;
    if (!payload?.success || !next) return false;
    window.localStorage.setItem('bmw_access_token', next);
    return true;
  }, API_BASE);
}

/**
 * Opens one of the three apps with a session for `email`, reusing the cached
 * storage state from a previous run when it is still valid, otherwise
 * performing a full UI login (and caching the result).
 */
export async function openApp(
  browser: Browser,
  app: AppName,
  email: string,
  password: string = DEMO_PASSWORD,
): Promise<UiSession> {
  const statePath = authStatePath(app, email);
  const context = await browser.newContext(
    existsSync(statePath) ? { storageState: statePath } : {},
  );
  const page = await context.newPage();

  await page.goto(`${APPS[app]}/`);
  const usable = await sessionUsable(page);
  if (!usable) {
    await uiLogin(page, app, email, password);
  }

  mkdirSync(AUTH_DIR, { recursive: true });
  await context.storageState({ path: statePath });
  return { context, page, email };
}

/* ------------------------------------------------------------------ */
/* Listing helpers                                                     */
/* ------------------------------------------------------------------ */

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Writes a 1×1 PNG once and returns its path (for the partner photo upload). */
export function tinyPngPath(): string {
  mkdirSync(path.join(HERE, '..', 'test-results'), { recursive: true });
  const file = path.join(HERE, '..', 'test-results', 'e2e-upload.png');
  if (!existsSync(file)) writeFileSync(file, Buffer.from(TINY_PNG_BASE64, 'base64'));
  return file;
}

/** Body accepted by `POST /partner/listings` (createListingSchema, price in major units). */
export function apiListingPayload(input: {
  categoryId: string;
  title: string;
  capacity?: number;
  city?: string;
}): Record<string, unknown> {
  return {
    type: 'WAREHOUSE',
    title: input.title,
    description: `${input.title} — automated end-to-end listing with racking, security, dock access and 24x7 gate coverage for the e2e suite.`,
    categoryId: input.categoryId,
    location: {
      addressLine1: '1 E2E Test Street',
      city: input.city ?? 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      country: 'India',
      coordinates: { lat: 18.5204, lng: 73.8567 },
    },
    price: { model: 'PER_DAY', amount: 1234, currency: 'INR', period: 'DAY', additionalCharges: [] },
    images: [`data:image/svg+xml;base64,${Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#0f766e"/></svg>',
    ).toString('base64')}`],
    amenities: ['Security'],
    safetyFeatures: ['Fire extinguishers'],
    rules: ['Business use only'],
    cancellationTerms: {
      policy: 'MODERATE',
      description: 'Free cancellation up to 48 hours before the start date.',
      customerRefundPercent: 100,
    },
    warehouse: {
      facilityType: 'DISTRIBUTION',
      storageTypes: ['GENERAL'],
      totalCapacity: input.capacity ?? 100,
      capacityUnit: 'PALLET',
      loadingDocks: 2,
      driveways: 1,
      temperatureControlled: false,
      humidityControlled: false,
      powerBackup: true,
      fireSafety: true,
      cctv: true,
      certifications: [],
      operatingHours: '24x7',
    },
  };
}

/** First WAREHOUSE category id (seeded: "General Warehousing"). */
export async function firstWarehouseCategoryId(): Promise<string> {
  const ctx = await publicApi();
  const res = await ctx.get(apiUrl('/catalog/categories?type=WAREHOUSE'));
  const body = (await res.json()) as Envelope<{ items: { id: string }[] }>;
  const id = body.data?.items?.[0]?.id;
  expect(id, 'expected a seeded WAREHOUSE category').toBeTruthy();
  await ctx.dispose();
  return id as string;
}

/**
 * Fills the partner "create listing" form (all required fields for a WAREHOUSE
 * listing) and submits it. Leaves the page on the new listing's detail page.
 */
export async function fillAndSubmitListingForm(page: Page, title: string): Promise<void> {
  await page.goto(`${APPS.partner}/listings/new`);
  await expect(page.locator('#listing-title')).toBeVisible();

  await page.locator('#listing-title').fill(title);
  await page
    .locator('#listing-description')
    .fill(
      `${title} — spacious automated test warehouse with racking, CCTV, power backup and dock access, built for end-to-end coverage.`,
    );
  // Category options are DB ids, so pick the first WAREHOUSE category.
  await page.locator('#listing-category').selectOption({ index: 1 });
  await page.locator('#loc-line1').fill('1 E2E Test Street');
  await page.locator('#loc-city').fill('Pune');
  await page.locator('#loc-state').fill('Maharashtra');
  await page.locator('#loc-postal').fill('411001');
  await page.locator('#price-model').selectOption('PER_DAY');
  await page.locator('#price-amount').fill('1234');
  await page.locator('#price-period').selectOption('DAY');

  await page.locator('#wh-facility').selectOption('DISTRIBUTION');
  await page.locator('#wh-capacity').fill('100');
  await page.locator('#wh-capacity-unit').selectOption('PALLET');
  // "Storage types" is the only fieldset-checklist on the warehouse form.
  await page.locator('.fieldset--inline input[type="checkbox"]').first().check();

  await page
    .locator('#cancel-description')
    .fill('Free cancellation up to 48 hours before the start date; 50% refund up to 24 hours.');

  await page.locator('input[type="file"]').first().setInputFiles(tinyPngPath());
  await expect(page.locator('.upload-list__item--done').first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Create listing' }).click();
  await expect(page, 'creating a listing should open its detail page').toHaveURL(/\/listings\/[a-z0-9]+/i, {
    timeout: 30_000,
  });
}
