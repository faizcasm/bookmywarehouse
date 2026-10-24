/**
 * Typed API client implementing the BookMyWarehouse API conventions.
 *
 * Mirrors apps/customer/src/lib/api.ts minus the DOM. Key differences from the
 * web client, driven by React Native's fetch not persisting cookies:
 *
 *  - The refresh token lives in an httpOnly `bmw_rt` cookie server-side. We
 *    capture its value (and the readable `bmw_csrf` value) from the `Set-Cookie`
 *    header at login/refresh and store them in SessionStore.
 *  - Ordinary requests send **pure Bearer with no cookies**, so the API's CSRF
 *    middleware passes them through untouched (csrf.ts:42). No X-CSRF-Token is
 *    needed for normal calls.
 *  - `/auth/refresh` and `/auth/logout` replay `Cookie: bmw_rt=…; bmw_csrf=…`
 *    plus `X-CSRF-Token` — the same double-submit a browser performs.
 *  - A 401 triggers one single-flight refresh, then the original request is
 *    replayed once; if refresh fails the session is cleared.
 *
 * Envelope: `{ success, data, meta?, requestId? }`. Errors: typed ApiError.
 */

import { API_BASE, REQUEST_TIMEOUT_MS } from '@/constants/config';
import { sessionStore } from './session';
import type { ApiErrorIssue, EnvelopeMeta, Paginated } from '@/types';

export { API_BASE };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: ApiErrorIssue[];

  constructor(status: number, code: string, message: string, issues: ApiErrorIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  /** First validation message for a given field path, if any. */
  issueFor(path: string): string | undefined {
    return this.issues.find((issue) => issue.path === path)?.message;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/* ------------------------------------------------------------------ */
/* Set-Cookie parsing                                                  */
/* ------------------------------------------------------------------ */

/**
 * Extract a cookie value by name from one or more Set-Cookie header strings.
 * Handles the common `name=value; Path=/; HttpOnly` form and is tolerant of
 * multiple cookies joined into a single string (which RN's Headers does on
 * some platforms).
 */
export function parseSetCookie(headers: Record<string, string | null>, name: string): string | null {
  // RN Headers may join multiple Set-Cookie with ", " — split on the cookie
  // name boundary rather than commas (which can appear in Expires dates).
  const raw = headers['set-cookie'] ?? headers['Set-Cookie'] ?? null;
  if (!raw) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp(`(?:^|[,,]\\s*)${escaped}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

/* ------------------------------------------------------------------ */
/* Query building                                                      */
/* ------------------------------------------------------------------ */

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export function buildUrl(path: string, query?: QueryParams): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

/* ------------------------------------------------------------------ */
/* Error normalization                                                 */
/* ------------------------------------------------------------------ */

function normalizeIssues(error: Record<string, unknown> | null | undefined): ApiErrorIssue[] {
  if (!error) return [];
  const issues = error.issues;
  if (Array.isArray(issues)) {
    return issues
      .map((issue) => {
        if (issue && typeof issue === 'object') {
          const record = issue as Record<string, unknown>;
          return {
            path: typeof record.path === 'string' ? record.path : undefined,
            message: typeof record.message === 'string' ? record.message : 'Invalid value',
          };
        }
        return { message: String(issue) };
      })
      .filter((issue): issue is ApiErrorIssue => Boolean(issue.message));
  }
  const details = error.details as Record<string, unknown> | undefined;
  const fields = details?.fields;
  if (fields && typeof fields === 'object') {
    return Object.entries(fields as Record<string, unknown>).map(([path, message]) => ({
      path,
      message: typeof message === 'string' ? message : String(message),
    }));
  }
  return [];
}

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHENTICATED';
    case 402:
      return 'PAYMENT_FAILED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 412:
      return 'PRECONDITION_FAILED';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status === 0 ? 'NETWORK_ERROR' : 'INTERNAL_ERROR';
  }
}

function toApiError(status: number, payload: Record<string, unknown> | null): ApiError {
  const error = (payload?.error ?? null) as Record<string, unknown> | null;
  const code = typeof error?.code === 'string' ? error.code : statusToCode(status);
  const message =
    typeof error?.message === 'string' && error.message
      ? error.message
      : status === 0
        ? 'No internet connection. Please try again.'
        : 'Something went wrong. Please try again.';
  return new ApiError(status, code, message, normalizeIssues(error));
}

/* ------------------------------------------------------------------ */
/* Request plumbing                                                    */
/* ------------------------------------------------------------------ */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  skipAuth?: boolean;
  /** Attach the stored cookies (bmw_rt + bmw_csrf) + CSRF header. Auth routes only. */
  withCookies?: boolean;
}

interface FetchLike {
  (url: string, init?: RequestInit): Promise<Response>;
}

let fetchImpl: FetchLike = (url, init) => fetch(url, init);
let refreshImpl: () => Promise<boolean> = defaultRefresh;

/** Override fetch (tests) and the refresh function (tests). */
export function __setFetch(fn: FetchLike): void {
  fetchImpl = fn;
}
export function __setRefresh(fn: () => Promise<boolean>): void {
  refreshImpl = fn;
}

/** Notified when a refresh fails and the session is cleared. */
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
export function onUnauthorized(fn: UnauthorizedListener): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

let refreshPromise: Promise<boolean> | null = null;

function buildHeaders(options: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (!options.skipAuth) {
    const token = sessionStore.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.withCookies) {
    const refresh = sessionStore.getRefreshToken();
    const csrf = sessionStore.getCsrfToken();
    const cookieParts: string[] = [];
    if (refresh) cookieParts.push(`bmw_rt=${encodeURIComponent(refresh)}`);
    if (csrf) cookieParts.push(`bmw_csrf=${encodeURIComponent(csrf)}`);
    if (cookieParts.length) headers['Cookie'] = cookieParts.join('; ');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  return headers;
}

/** Read Set-Cookie from a response and persist any auth cookies we care about. */
function captureAuthCookies(res: Response): void {
  let raw: string | null = null;
  try {
    // RN exposes headers as a plain object; getSetCookie exists on web/undici.
    const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[]; rawHeaders?: string[] };
    if (typeof anyHeaders.getSetCookie === 'function') {
      raw = anyHeaders.getSetCookie().join(', ');
    } else {
      raw = res.headers.get('set-cookie');
    }
  } catch {
    raw = res.headers.get('set-cookie');
  }
  if (!raw) return;
  const rt = parseSetCookie({ 'set-cookie': raw }, 'bmw_rt');
  const csrf = parseSetCookie({ 'set-cookie': raw }, 'bmw_csrf');
  const updates: { refreshToken?: string | null; csrfToken?: string | null } = {};
  if (rt) updates.refreshToken = rt;
  if (csrf) updates.csrfToken = csrf;
  if (Object.keys(updates).length) void sessionStore.set(updates);
}

async function defaultRefresh(): Promise<boolean> {
  // Single-flight: concurrent 401s share one refresh.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetchImpl(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: buildHeaders({ method: 'POST', withCookies: true }),
        });
        if (!res.ok) return false;
        const payload = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: { accessToken?: string; csrfToken?: string } }
          | null;
        const token = payload?.data?.accessToken;
        if (payload?.success && token) {
          captureAuthCookies(res);
          await sessionStore.set({
            accessToken: token,
            csrfToken: payload.data?.csrfToken ?? sessionStore.getCsrfToken(),
          });
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const url = buildUrl(path, options.query);
  const send = (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    // Chain a caller-provided signal if present.
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return fetchImpl(url, {
      method: options.method ?? 'GET',
      headers: buildHeaders(options),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  };

  let res = await send();
  const isAuthRoute = path.startsWith('/auth/');
  if (res.status === 401 && !options.skipAuth && !isAuthRoute) {
    const refreshed = await refreshImpl();
    if (refreshed) {
      res = await send();
    } else {
      await sessionStore.clear();
      unauthorizedListeners.forEach((fn) => fn());
    }
  }
  return res;
}

export interface ApiResponse<T> {
  data: T;
  meta?: EnvelopeMeta;
  requestId?: string;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const res = await rawRequest(path, options);
  let payload: Record<string, unknown> | null;
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }
  if (!res.ok || payload?.success === false) {
    throw toApiError(res.status, payload);
  }
  return {
    data: payload?.data as T,
    meta: payload?.meta as EnvelopeMeta | undefined,
    requestId: typeof payload?.requestId === 'string' ? payload.requestId : undefined,
  };
}

/** Fetch a raw text resource (e.g. the printable invoice HTML) with auth handling. */
export async function apiText(path: string, options: RequestOptions = {}): Promise<string> {
  const res = await rawRequest(path, { ...options, method: options.method ?? 'GET' });
  if (!res.ok) {
    let payload: Record<string, unknown> | null;
    try {
      payload = (await res.json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }
    throw toApiError(res.status, payload);
  }
  return res.text();
}

export const api = {
  get<T>(path: string, query?: QueryParams, options?: Omit<RequestOptions, 'method' | 'body' | 'query'>): Promise<T> {
    return apiRequest<T>(path, { ...options, method: 'GET', query }).then((r) => r.data);
  },
  getWithMeta<T>(
    path: string,
    query?: QueryParams,
    options?: Omit<RequestOptions, 'method' | 'body' | 'query'>,
  ): Promise<ApiResponse<T>> {
    return apiRequest<T>(path, { ...options, method: 'GET', query });
  },
  /** GET a `{ items }` collection and merge the envelope's pagination meta. */
  getPaged<T>(path: string, query?: QueryParams): Promise<Paginated<T>> {
    return apiRequest<{ items: T[] }>(path, { method: 'GET', query }).then((r) => ({
      items: r.data?.items ?? [],
      meta: r.meta,
    }));
  },
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return apiRequest<T>(path, { ...options, method: 'POST', body }).then((r) => r.data);
  },
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return apiRequest<T>(path, { ...options, method: 'PATCH', body }).then((r) => r.data);
  },
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return apiRequest<T>(path, { ...options, method: 'PUT', body }).then((r) => r.data);
  },
  delete<T>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return apiRequest<T>(path, { ...options, method: 'DELETE' }).then((r) => r.data);
  },
};
