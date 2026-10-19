/**
 * Typed fetch wrapper for the BookMyWarehouse API (docs/API_REFERENCE.md §1–2):
 * - unwraps the `{ success, data, meta }` envelope
 * - always sends `credentials: 'include'` (refresh + CSRF cookies)
 * - attaches `Authorization: Bearer <token>` (memory + localStorage)
 * - attaches `X-CSRF-Token` (from the readable `bmw_csrf` cookie) on non-GET
 * - performs a single automatic `POST /auth/refresh` + retry on 401
 * - surfaces failures as a typed `ApiError { status, code, message, issues }`
 */

const BASE_URL: string =
  (import.meta.env?.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

export const ACCESS_TOKEN_KEY = 'bmw_access_token';
export const CSRF_COOKIE = 'bmw_csrf';

export interface ApiIssue {
  path: string;
  message: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
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

  /** First validation issue for a given field path (top-level or nested prefix). */
  issueFor(path: string): string | undefined {
    return this.issues.find((issue) => issue.path === path || issue.path.startsWith(`${path}.`))?.message;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Human-readable message for any thrown error. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isApiError(error)) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

let accessToken: string | null = null;
try {
  accessToken = globalThis.localStorage?.getItem(ACCESS_TOKEN_KEY) ?? null;
} catch {
  accessToken = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  try {
    if (token) globalThis.localStorage?.setItem(ACCESS_TOKEN_KEY, token);
    else globalThis.localStorage?.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    /* storage unavailable — memory-only token */
  }
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(document.cookie);
  return match ? decodeURIComponent(match[1]!) : null;
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Register a callback fired when a session is definitively gone (refresh failed). */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized(): void {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* listener errors must not break request flow */
    }
  });
}

/** Auth endpoints are exempt from the CSRF requirement (API_REFERENCE §2). */
const CSRF_EXEMPT = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
];

export interface QueryParams {
  [key: string]: string | number | boolean | undefined | null;
}

export function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  /** Extra headers (rarely needed). */
  headers?: Record<string, string>;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: { pagination?: Pagination; [key: string]: unknown };
  error?: { code?: string; message?: string; issues?: ApiIssue[] };
  requestId?: string;
}

function parseIssues(payload: Envelope<unknown>): ApiIssue[] {
  const issues = payload.error?.issues;
  if (Array.isArray(issues)) {
    return issues
      .filter((issue): issue is ApiIssue => Boolean(issue && typeof issue.path === 'string'))
      .map((issue) => ({ path: String(issue.path), message: String(issue.message ?? 'Invalid value') }));
  }
  return [];
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<{ data: T; meta?: Envelope<unknown>['meta'] }> {
  const method = options.method ?? 'GET';
  const url = `${BASE_URL}${path}${buildQuery(options.query)}`;

  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (method !== 'GET' && !CSRF_EXEMPT.some((p) => path.startsWith(p))) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.');
  }

  let payload: Envelope<T>;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiError(response.status, 'BAD_RESPONSE', `Unexpected server response (${response.status})`);
  }

  if (response.ok && payload.success) {
    return { data: payload.data as T, meta: payload.meta };
  }

  if (response.status === 401 && !isRetry && !CSRF_EXEMPT.some((p) => path.startsWith(p))) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return request<T>(path, options, true);
    }
    setAccessToken(null);
    notifyUnauthorized();
    throw new ApiError(
      401,
      payload.error?.code ?? 'UNAUTHENTICATED',
      payload.error?.message ?? 'Your session has expired. Please sign in again.',
      parseIssues(payload),
    );
  }

  throw new ApiError(
    response.status,
    payload.error?.code ?? `HTTP_${response.status}`,
    payload.error?.message ?? `Request failed (${response.status})`,
    parseIssues(payload),
  );
}

let refreshPromise: Promise<string | null> | null = null;

function attemptRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const csrf = readCookie(CSRF_COOKIE);
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: csrf ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : { 'Content-Type': 'application/json' },
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as Envelope<{ accessToken?: string }>;
        const token = payload.data?.accessToken;
        if (token) {
          setAccessToken(token);
          return token;
        }
        return null;
      } catch {
        return null;
      } finally {
        // Allow a fresh attempt for the next 401.
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

export interface ListResult<T, D = { items: T[] }> {
  items: T[];
  pagination: Pagination | null;
  /** Full `data` object for extra fields (unread counts, averages, summaries…). */
  data: D;
}

export const api = {
  async get<T>(path: string, query?: QueryParams): Promise<T> {
    return (await request<T>(path, { method: 'GET', query })).data;
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    return (await request<T>(path, { method: 'POST', body })).data;
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return (await request<T>(path, { method: 'PATCH', body })).data;
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    return (await request<T>(path, { method: 'PUT', body })).data;
  },

  async del<T>(path: string): Promise<T> {
    return (await request<T>(path, { method: 'DELETE' })).data;
  },

  /** List helper — unwraps `data.items` plus `meta.pagination`. */
  async list<T, D extends { items: T[] } = { items: T[] }>(
    path: string,
    query?: QueryParams,
  ): Promise<ListResult<T, D>> {
    const { data, meta } = await request<D>(path, { method: 'GET', query });
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      pagination: meta?.pagination ?? null,
      data,
    };
  },
};

/** Read a File as a data URI (used by upload widgets and the API `file` field). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/** POST /uploads — server returns `{ url }`. */
export async function uploadFile(file: File, folder: 'listings' | 'avatars' | 'documents' | 'logos'): Promise<string> {
  const dataUri = await fileToDataUrl(file);
  const result = await api.post<{ url: string }>('/uploads', { file: dataUri, folder });
  return result.url;
}
