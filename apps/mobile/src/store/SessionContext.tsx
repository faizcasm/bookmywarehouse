/**
 * Session context — restores the session on boot, exposes the current user and
 * auth actions, and redirects to login when the session is cleared.
 *
 * Boot sequence: load stored credentials → if an access/refresh token exists,
 * call GET /auth/me (refreshing first if needed) → set the user. A failed
 * restore clears the session silently (the user just sees themselves logged
 * out). The API client emits an unauthorized event when a refresh fails mid-
 * request, which drops the user back to login.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { sessionStore } from '@/services/api/session';
import * as authApi from '@/services/api/auth';
import { getMe } from '@/services/api/auth';
import { onUnauthorized } from '@/services/api/client';
import type { User } from '@/types';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionContextValue {
  status: SessionStatus;
  user: User | null;
  login: (input: authApi.LoginInput) => Promise<User>;
  register: (input: authApi.RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** True when the current user holds the given role. */
  hasRole: (...roles: User['role'][]) => boolean;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // Restore on mount.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await sessionStore.load();
        if (!sessionStore.hasSession()) {
          if (mounted) setStatus('unauthenticated');
          return;
        }
        const me = await getMe();
        if (mounted) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        // Token likely expired and refresh failed — clear and land logged out.
        await sessionStore.clear();
        if (mounted) {
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Drop to unauthenticated whenever the API client clears the session.
  useEffect(
    () =>
      onUnauthorized(() => {
        setUser(null);
        setStatus('unauthenticated');
      }),
    [],
  );

  const login = useCallback(async (input: authApi.LoginInput) => {
    const me = await authApi.login(input);
    setUser(me);
    setStatus('authenticated');
    return me;
  }, []);

  const register = useCallback(async (input: authApi.RegisterInput) => {
    const me = await authApi.register(input);
    setUser(me);
    setStatus('authenticated');
    return me;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      /* keep existing user on transient failure */
    }
  }, []);

  const hasRole = useCallback(
    (...roles: User['role'][]) => (user ? roles.includes(user.role) : false),
    [user],
  );

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, login, register, logout, refreshUser, hasRole }),
    [status, user, login, register, logout, refreshUser, hasRole],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
