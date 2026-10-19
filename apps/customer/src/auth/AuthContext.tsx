import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  clearSession,
  getAccessToken,
  setAccessToken,
  SESSION_CLEARED_EVENT,
} from '../lib/api';
import type { AuthPayload, PlatformSettingsDTO, UserDTO } from '../lib/types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: 'CUSTOMER' | 'PARTNER';
  phone?: string | null;
  businessName?: string | null;
}

interface AuthContextValue {
  user: UserDTO | null;
  loading: boolean;
  platform: PlatformSettingsDTO | null;
  login: (email: string, password: string) => Promise<UserDTO>;
  register: (input: RegisterInput) => Promise<UserDTO>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserDTO | null>;
  /** Merge updated user fields (e.g. after a profile PATCH). */
  updateUser: (user: UserDTO) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const PARTNER_APP_URL = 'http://localhost:5174';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [platform, setPlatform] = useState<PlatformSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!getAccessToken()) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const data = await api.get<{ user: UserDTO; platform?: PlatformSettingsDTO }>('/auth/me');
        if (!cancelled) {
          setUser(data.user);
          if (data.platform) setPlatform(data.platform);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();

    const onSessionCleared = () => setUser(null);
    window.addEventListener(SESSION_CLEARED_EVENT, onSessionCleared);
    return () => {
      cancelled = true;
      window.removeEventListener(SESSION_CLEARED_EVENT, onSessionCleared);
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<UserDTO> => {
    const data = await api.post<AuthPayload>('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (input: RegisterInput): Promise<UserDTO> => {
    const data = await api.post<AuthPayload>('/auth/register', input);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      /* clearing the local session must not fail */
    }
    clearSession();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<UserDTO | null> => {
    try {
      const data = await api.get<{ user: UserDTO; platform?: PlatformSettingsDTO }>('/auth/me');
      setUser(data.user);
      if (data.platform) setPlatform(data.platform);
      return data.user;
    } catch {
      return null;
    }
  }, []);

  const updateUser = useCallback((next: UserDTO) => setUser(next), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, platform, login, register, logout, refreshUser, updateUser }),
    [user, loading, platform, login, register, logout, refreshUser, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
