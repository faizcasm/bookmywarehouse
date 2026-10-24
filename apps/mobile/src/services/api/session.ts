/**
 * Secure storage for session credentials.
 *
 * React Native's `fetch` does not persist cookies across launches, and the
 * BookMyWarehouse API keeps the refresh token in an httpOnly `bmw_rt` cookie.
 * The mobile client therefore captures that cookie's value (and the readable
 * `bmw_csrf` value) from the `Set-Cookie` header at login/refresh and stores
 * them here, replaying them as an explicit `Cookie` header only on
 * `/auth/refresh` and `/auth/logout`. See MOBILE_API_INTEGRATION.md §3.2.
 *
 * Values are held in memory (synchronously readable) and mirrored to
 * expo-secure-store (Keychain / Android Keystore) so a cold start can restore
 * the session. The storage backend is injectable for tests.
 */

import * as SecureStore from 'expo-secure-store';

export interface TokenStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Production backend: expo-secure-store. */
export const secureTokenStorage: TokenStorage = {
  async get(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* storage unavailable — in-memory copy still holds the value */
    }
  },
  async remove(key) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* ignore */
    }
  },
};

/** In-memory backend for tests / environments without SecureStore. */
export function createMemoryStorage(): TokenStorage {
  const map = new Map<string, string>();
  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async remove(key) {
      map.delete(key);
    },
  };
}

export const STORAGE_KEYS = {
  accessToken: 'bmw_access_token',
  refreshToken: 'bmw_refresh_token',
  csrfToken: 'bmw_csrf_token',
} as const;

export interface SessionSnapshot {
  accessToken: string | null;
  refreshToken: string | null;
  csrfToken: string | null;
}

/**
 * Holds the current session credentials. The access token is kept in memory for
 * synchronous reads when building request headers; all three are persisted to
 * the storage backend for cold-start restore.
 */
export class SessionStore {
  private storage: TokenStorage;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private csrfToken: string | null = null;
  private loaded = false;

  constructor(storage: TokenStorage = secureTokenStorage) {
    this.storage = storage;
  }

  /** Load persisted credentials into memory. Call once at app startup. */
  async load(): Promise<SessionSnapshot> {
    if (!this.loaded) {
      const [access, refresh, csrf] = await Promise.all([
        this.storage.get(STORAGE_KEYS.accessToken),
        this.storage.get(STORAGE_KEYS.refreshToken),
        this.storage.get(STORAGE_KEYS.csrfToken),
      ]);
      this.accessToken = access;
      this.refreshToken = refresh;
      this.csrfToken = csrf;
      this.loaded = true;
    }
    return this.snapshot();
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  getCsrfToken(): string | null {
    return this.csrfToken;
  }

  snapshot(): SessionSnapshot {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      csrfToken: this.csrfToken,
    };
  }

  hasSession(): boolean {
    return Boolean(this.accessToken || this.refreshToken);
  }

  /** Persist a full credential set (from a login / refresh response). */
  async set(tokens: {
    accessToken?: string | null;
    refreshToken?: string | null;
    csrfToken?: string | null;
  }): Promise<void> {
    if (tokens.accessToken !== undefined) {
      this.accessToken = tokens.accessToken;
      await this.persist(STORAGE_KEYS.accessToken, tokens.accessToken);
    }
    if (tokens.refreshToken !== undefined) {
      this.refreshToken = tokens.refreshToken;
      await this.persist(STORAGE_KEYS.refreshToken, tokens.refreshToken);
    }
    if (tokens.csrfToken !== undefined) {
      this.csrfToken = tokens.csrfToken;
      await this.persist(STORAGE_KEYS.csrfToken, tokens.csrfToken);
    }
  }

  async clear(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.csrfToken = null;
    await Promise.all([
      this.storage.remove(STORAGE_KEYS.accessToken),
      this.storage.remove(STORAGE_KEYS.refreshToken),
      this.storage.remove(STORAGE_KEYS.csrfToken),
    ]);
  }

  private async persist(key: string, value: string | null): Promise<void> {
    if (value) await this.storage.set(key, value);
    else await this.storage.remove(key);
  }
}

/** The app-wide session store instance. */
export const sessionStore = new SessionStore();
