/**
 * Fetch wrapper for the BookMyWarehouse admin console.
 *
 * Implements docs/API_REFERENCE.md §1–2:
 *  - response envelope unwrapping
 *  - Bearer access token (memory + localStorage `bmw_access_token`)
 *  - `credentials: 'include'` on every request
 *  - `X-CSRF-Token` header (from readable `bmw_csrf` cookie) on non-GET requests
 *  - single auto-refresh on 401 (`POST /auth/refresh`) with one retry, else logout
 *  - typed ApiError with status/code/message/issues
 */

export const API_BASE: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:4000/api/v1' : '/api/v1');

const TOKEN_KEY = 'bmw_access_token';
const CSRF_COOKIE = 'bmw_csrf';

let memoryToken: string | null = null;

export function setAccessToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* storage unavailable (private mode) — memory token still works */
  }
}

export function getAccessToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = window.localStorage.getItem(TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1] as string) : null;
}

export interface ApiIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: ApiIssue[];

  constructor(status: number, code: string, message: string, issues: ApiIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  /** Flatten issues into a field → first message map for inline form errors. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const issue of this.issues) {
      if (!out[issue.path]) out[issue.path] = issue.message;
    }
    return out;
  }
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiEnvelopeMeta {
  pagination?: Pagination;
}

export interface ApiResult<T> {
  data: T;
  meta?: ApiEnvelopeMeta;
}

interface RefreshPayload {
  user?: unknown;
  accessToken?: string;
  csrfToken?: string;
}

let refreshPromise: Promise<boolean> | null = null;

/** Concurrent 401s share one in-flight refresh. */
async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const headers: Record<string, string> = {};
        const csrf = readCookie(CSRF_COOKIE);
        if (csrf) headers['X-CSRF-Token'] = csrf;
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers,
        });
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: RefreshPayload }
          | null;
        const token = json?.data?.accessToken;
        if (res.ok && json?.success && token) {
          setAccessToken(token);
          return true;
        }
        setAccessToken(null);
        return false;
      } catch {
        setAccessToken(null);
        return false;
      } finally {
        // allow a fresh refresh attempt for later requests
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registered by AuthContext; called when a session can no longer be refreshed. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip Authorization header + refresh handling (used for login). */
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  // API_BASE may be a same-origin path (e.g. "/api/v1") in production — give
  // URL() an explicit base so relative values do not throw.
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseEnvelope<T>(res: Response): Promise<ApiResult<T>> {
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: T; meta?: ApiEnvelopeMeta; error?: { code?: string; message?: string; issues?: ApiIssue[] } }
    | null;

  if (!res.ok || !json?.success) {
    const error = json?.error;
    const issues = error?.issues ?? [];
    // VALIDATION_ERROR sometimes carries details.fields instead of issues
    if (issues.length === 0 && json && 'error' in json && res.status === 422) {
      const details = (json as { error?: { details?: { fields?: Record<string, string> } } }).error?.details?.fields;
      if (details) {
        for (const [path, message] of Object.entries(details)) issues.push({ path, message });
      }
    }
    throw new ApiError(
      res.status,
      error?.code ?? (res.ok ? 'UNKNOWN' : `HTTP_${res.status}`),
      error?.message ?? `Request failed with status ${res.status}`,
      issues,
    );
  }

  return { data: json.data as T, meta: json.meta };
}

async function rawRequest<T>(path: string, options: RequestOptions): Promise<ApiResult<T>> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (method !== 'GET') {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
  return parseEnvelope<T>(res);
}

/**
 * Perform a request, transparently unwrapping the envelope.
 * On 401 (UNAUTHENTICATED) attempts one token refresh and retries once;
 * if the refresh fails, the unauthorized handler fires (logout).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    const isAuthFlow = options.auth === false || path.startsWith('/auth/login') || path.startsWith('/auth/refresh');
    if (err instanceof ApiError && err.status === 401 && !isAuthFlow) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return await rawRequest<T>(path, options);
      }
      unauthorizedHandler?.();
      throw err;
    }
    throw err;
  }
}

export async function apiGet<T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal): Promise<T> {
  const res = await apiRequest<T>(path, { method: 'GET', query, signal });
  return res.data;
}

export async function apiSend<T>(
  method: Exclude<RequestOptions['method'], 'GET' | undefined>,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await apiRequest<T>(path, { method, body });
  return res.data;
}

export async function apiList<T>(
  path: string,
  query?: RequestOptions['query'],
  signal?: AbortSignal,
): Promise<{ items: T[]; meta?: ApiEnvelopeMeta }> {
  const res = await apiRequest<{ items: T[] }>(path, { method: 'GET', query, signal });
  return { items: res.data?.items ?? [], meta: res.meta };
}
