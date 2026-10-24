/**
 * API client tests — envelope unwrapping, error normalization, auth headers,
 * cookie replay and the single-flight 401 refresh flow.
 */

import { api, apiRequest, parseSetCookie, ApiError, __setFetch, __setRefresh, onUnauthorized } from '../client';
import { sessionStore, createMemoryStorage, SessionStore } from '../session';

// The client module holds a singleton sessionStore; point it at memory so tests
// don't touch SecureStore and stay isolated.
(sessionStore as unknown as { storage: ReturnType<typeof createMemoryStorage> }).storage =
  createMemoryStorage();

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? null,
      getSetCookie: () => (headers['set-cookie'] ? [headers['set-cookie']] : []),
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(async () => {
  await sessionStore.clear();
});

describe('parseSetCookie', () => {
  it('extracts a cookie value by name', () => {
    const raw = 'bmw_rt=abc123; Path=/; HttpOnly; SameSite=Lax, bmw_csrf=xyz; Path=/';
    expect(parseSetCookie({ 'set-cookie': raw }, 'bmw_rt')).toBe('abc123');
    expect(parseSetCookie({ 'set-cookie': raw }, 'bmw_csrf')).toBe('xyz');
  });

  it('returns null when the cookie is absent', () => {
    expect(parseSetCookie({ 'set-cookie': 'other=1' }, 'bmw_rt')).toBeNull();
    expect(parseSetCookie({}, 'bmw_rt')).toBeNull();
  });
});

describe('apiRequest', () => {
  it('unwraps the success envelope to data + meta', async () => {
    __setFetch(async () =>
      jsonResponse(200, {
        success: true,
        data: { items: [1, 2] },
        meta: { pagination: { page: 1, limit: 20, totalItems: 2, totalPages: 1 } },
      }),
    );
    const res = await apiRequest<{ items: number[] }>('/things');
    expect(res.data.items).toEqual([1, 2]);
    expect(res.meta?.pagination?.totalItems).toBe(2);
  });

  it('throws a typed ApiError for a failure envelope', async () => {
    __setFetch(async () =>
      jsonResponse(422, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Bad input', issues: [{ path: 'email', message: 'Invalid' }] },
      }),
    );
    await expect(api.get('/x')).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      issues: [{ path: 'email', message: 'Invalid' }],
    });
  });

  it('attaches a Bearer token when a session exists', async () => {
    await sessionStore.set({ accessToken: 'tok' });
    let authHeader: string | undefined;
    __setFetch(async (_url, init) => {
      authHeader = (init?.headers as Record<string, string>)?.['Authorization'];
      return jsonResponse(200, { success: true, data: {} });
    });
    await api.get('/me');
    expect(authHeader).toBe('Bearer tok');
  });

  it('omits Authorization for skipAuth requests', async () => {
    await sessionStore.set({ accessToken: 'tok' });
    let authHeader: string | undefined;
    __setFetch(async (_url, init) => {
      authHeader = (init?.headers as Record<string, string>)?.['Authorization'];
      return jsonResponse(200, { success: true, data: {} });
    });
    await api.post('/auth/login', {}, { skipAuth: true });
    expect(authHeader).toBeUndefined();
  });
});

describe('401 refresh flow', () => {
  it('refreshes once and replays the original request', async () => {
    await sessionStore.set({ accessToken: 'old' });
    let calls = 0;
    __setRefresh(async () => {
      await sessionStore.set({ accessToken: 'new' });
      return true;
    });
    __setFetch(async () => {
      calls += 1;
      // First call 401s; after refresh, succeeds.
      return calls === 1
        ? jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'expired' } })
        : jsonResponse(200, { success: true, data: { ok: true } });
    });

    const res = await api.get<{ ok: boolean }>('/protected');
    expect(res.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it('clears the session and notifies listeners when refresh fails', async () => {
    await sessionStore.set({ accessToken: 'old', refreshToken: 'r' });
    const unauthorized = jest.fn();
    const unsub = onUnauthorized(unauthorized);

    __setRefresh(async () => false);
    __setFetch(async () =>
      jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'expired' } }),
    );

    await expect(api.get('/protected')).rejects.toBeInstanceOf(ApiError);
    expect(unauthorized).toHaveBeenCalled();
    expect(sessionStore.getAccessToken()).toBeNull();
    unsub();
  });

  it('does not attempt refresh on auth routes', async () => {
    const refresh = jest.fn();
    __setRefresh(refresh);
    __setFetch(async () =>
      jsonResponse(401, { success: false, error: { code: 'BAD_CREDENTIALS', message: 'wrong' } }),
    );
    await expect(api.post('/auth/login', {}, { skipAuth: true })).rejects.toBeInstanceOf(ApiError);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('SessionStore cold-start', () => {
  it('restores tokens from the storage backend', async () => {
    const storage = createMemoryStorage();
    const a = new SessionStore(storage);
    await a.load();
    await a.set({ accessToken: 'a', refreshToken: 'r' });

    const b = new SessionStore(storage);
    const snap = await b.load();
    expect(snap.accessToken).toBe('a');
    expect(b.hasSession()).toBe(true);
  });
});
