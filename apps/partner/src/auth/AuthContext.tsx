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
import { api, onUnauthorized, setAccessToken, getAccessToken } from '../lib/api';
import type { UserDTO } from '../lib/types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  businessName?: string;
}

interface AuthContextValue {
  user: UserDTO | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserDTO>;
  register: (input: RegisterInput) => Promise<UserDTO>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserDTO | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthPayload {
  user: UserDTO;
  accessToken?: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const fetchMe = useCallback(async (): Promise<UserDTO | null> => {
    try {
      const data = await api.get<AuthPayload>('/auth/me');
      setUser(data.user ?? null);
      return data.user ?? null;
    } catch {
      setAccessToken(null);
      if (mounted.current) setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Always confirm the stored token with GET /auth/me on boot (API_REFERENCE §2).
    void fetchMe().finally(() => {
      if (mounted.current) setLoading(false);
    });
    const off = onUnauthorized(() => {
      if (mounted.current) setUser(null);
    });
    return () => {
      mounted.current = false;
      off();
    };
  }, [fetchMe]);

  const login = useCallback(async (email: string, password: string): Promise<UserDTO> => {
    const data = await api.post<AuthPayload>('/auth/login', { email: email.trim(), password });
    if (data.accessToken) setAccessToken(data.accessToken);
    else setAccessToken(getAccessToken());
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (input: RegisterInput): Promise<UserDTO> => {
    const data = await api.post<AuthPayload>('/auth/register', {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      role: 'PARTNER',
      phone: input.phone?.trim() || undefined,
      businessName: input.businessName?.trim() || undefined,
    });
    if (data.accessToken) setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* logging out locally regardless */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refreshUser: fetchMe }),
    [user, loading, login, register, logout, fetchMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
