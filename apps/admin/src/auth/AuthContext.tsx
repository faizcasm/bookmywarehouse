import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiGet, apiSend, getAccessToken, setAccessToken, setUnauthorizedHandler } from '../lib/api';
import type { AuthUser } from '../lib/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** ADMIN-only login. Resolves with the authenticated user. */
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface MeResponse {
  user: AuthUser;
  profile?: unknown;
  platform?: unknown;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAccessToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Boot: confirm any persisted token with GET /auth/me (API_REFERENCE §2).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getAccessToken()) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await apiGet<MeResponse>('/auth/me');
        if (!cancelled) setUser(me.user ?? null);
      } catch {
        if (!cancelled) setAccessToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const data = await apiSend<{ user: AuthUser; accessToken: string }>('POST', '/auth/login', {
      email,
      password,
    });
    if (data.user.role !== 'ADMIN') {
      // Never persist a non-admin session in the admin console.
      setAccessToken(null);
      setUser(null);
      const err = new Error('This console is restricted to administrator accounts.');
      err.name = 'RoleError';
      throw err;
    }
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiSend('POST', '/auth/logout');
    } catch {
      /* token already invalid — clear locally regardless */
    }
    if (mounted.current) clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiGet<MeResponse>('/auth/me');
      setUser(me.user ?? null);
    } catch {
      if (mounted.current) setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
