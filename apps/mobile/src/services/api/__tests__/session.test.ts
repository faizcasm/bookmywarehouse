/** SessionStore tests — persistence, restore and clearing. */

import { SessionStore, createMemoryStorage, STORAGE_KEYS } from '../session';

describe('SessionStore', () => {
  it('starts empty and reports no session', async () => {
    const store = new SessionStore(createMemoryStorage());
    await store.load();
    expect(store.hasSession()).toBe(false);
    expect(store.getAccessToken()).toBeNull();
  });

  it('persists tokens and restores them on a fresh store (cold start)', async () => {
    const storage = createMemoryStorage();
    const store = new SessionStore(storage);
    await store.load();
    await store.set({ accessToken: 'a1', refreshToken: 'r1', csrfToken: 'c1' });

    expect(store.getAccessToken()).toBe('a1');
    expect(store.hasSession()).toBe(true);

    // Simulate a cold start reusing the same storage backend.
    const restored = new SessionStore(storage);
    const snap = await restored.load();
    expect(snap).toEqual({ accessToken: 'a1', refreshToken: 'r1', csrfToken: 'c1' });
    expect(restored.hasSession()).toBe(true);
  });

  it('treats a lone refresh token as a restorable session', async () => {
    const store = new SessionStore(createMemoryStorage());
    await store.load();
    await store.set({ refreshToken: 'r-only' });
    // No access token, but a refresh token means we can silently re-auth.
    expect(store.getAccessToken()).toBeNull();
    expect(store.hasSession()).toBe(true);
  });

  it('clears in-memory and persisted credentials', async () => {
    const storage = createMemoryStorage();
    const store = new SessionStore(storage);
    await store.load();
    await store.set({ accessToken: 'a', refreshToken: 'r', csrfToken: 'c' });
    await store.clear();

    expect(store.hasSession()).toBe(false);
    expect(store.getAccessToken()).toBeNull();
    expect(await storage.get(STORAGE_KEYS.accessToken)).toBeNull();
    expect(await storage.get(STORAGE_KEYS.refreshToken)).toBeNull();
    expect(await storage.get(STORAGE_KEYS.csrfToken)).toBeNull();
  });

  it('updates a single token without clobbering the others', async () => {
    const store = new SessionStore(createMemoryStorage());
    await store.load();
    await store.set({ accessToken: 'a1', refreshToken: 'r1', csrfToken: 'c1' });
    await store.set({ accessToken: 'a2' });

    expect(store.getAccessToken()).toBe('a2');
    expect(store.getRefreshToken()).toBe('r1');
    expect(store.getCsrfToken()).toBe('c1');
  });
});
