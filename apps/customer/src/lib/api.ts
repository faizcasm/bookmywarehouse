/**
 * Fetch wrapper implementing the BookMyWarehouse API conventions
 * (docs/API_REFERENCE.md §1–2):
 *  - JSON envelope unwrap (`{ success, data, meta }`)
 *  - `credentials: 'include'` on every request (refresh + CSRF cookies)
 *  - `Authorization: Bearer` from an in-memory token persisted in localStorage
 *  - `X-CSRF-Token` from the readable `bmw_csrf` cookie on non-GET requests
 *  - one automatic `POST /auth/refresh` retry on 401, otherwise session cleared
 *  - typed `ApiError { status, code, message, issues }`
 */

import type { ApiErrorIssue, EnvelopeMeta } from './types';

export const API_BASE: string =
  (import.meta.env?.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:4000/api/v1' : '/api/v1');

export const TOKEN_STORAGE_KEY = 'bmw_access_token';
export const CSRF_COOKIE_NAME = 'bmw_csrf';
export const SESSION_CLEARED_EVENT = 'bmw:session-cleared';

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
}

/* ------------------------------------------------------------------ */
/* Session token management                                            */
/* ------------------------------------------------------------------ */

let inMemoryToken: string | null = null;

export function getAccessToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    inMemoryToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    inMemoryToken = null;
  }
  return inMemoryToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryToken = token;
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable — keep the in-memory copy */
  }
}

export function clearSession(): void {
  setAccessToken(null);
  try {
    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
  } catch {
    /* non-DOM environment */
  }
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

/* ------------------------------------------------------------------ */
/* Request plumbing                                                    */
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

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip the Authorization header (used for public requests). */
  skipAuth?: boolean;
}

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

function toApiError(status: number, payload: Record<string, unknown> | null): ApiError {
  const error = (payload?.error ?? null) as Record<string, unknown> | null;
  const code = typeof error?.code === 'string' ? error.code : statusToCode(status);
  const message =
    typeof error?.message === 'string' && error.message
      ? error.message
      : 'Something went wrong. Please try again.';
  return new ApiError(status, code, message, normalizeIssues(error));
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
      return 'INTERNAL_ERROR';
  }
}

async function tryRefresh(): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    const csrf = readCookie(CSRF_COOKIE_NAME);
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers,
    });
    if (!res.ok) return false;
    const payload = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: { accessToken?: string } }
      | null;
    const token = payload?.data?.accessToken;
    if (payload?.success && token) {
      setAccessToken(token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function buildHeaders(options: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.method && options.method !== 'GET') {
    const csrf = readCookie(CSRF_COOKIE_NAME);
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  return headers;
}

/** Perform a request, transparently refreshing once on 401. Returns the raw Response. */
async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const url = buildUrl(path, options.query);
  const send = (): Promise<Response> =>
    fetch(url, {
      method: options.method ?? 'GET',
      headers: buildHeaders(options),
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

  let res = await send();
  const isAuthRoute = path.startsWith('/auth/');
  if (res.status === 401 && !options.skipAuth && !isAuthRoute) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await send();
    } else {
      clearSession();
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
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return apiRequest<T>(path, { ...options, method: 'POST', body }).then((r) => r.data);
  },
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return apiRequest<T>(path, { ...options, method: 'PATCH', body }).then((r) => r.data);
  },
  delete<T>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return apiRequest<T>(path, { ...options, method: 'DELETE' }).then((r) => r.data);
  },
};
