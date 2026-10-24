/**
 * Auth endpoints. The auth routes are the only place we capture Set-Cookie and
 * the only place we send cookies back (on refresh/logout). See client.ts.
 */

import { api, apiRequest, ApiError } from './client';
import { sessionStore } from './session';
import type { User } from '@/types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  role: 'CUSTOMER' | 'PARTNER';
  businessName?: string | null;
  acceptTerms?: boolean;
}

interface AuthPayload {
  user: User;
  accessToken: string;
  csrfToken?: string;
}

/** POST /auth/login — persists tokens + captured cookies. */
export async function login(input: LoginInput): Promise<User> {
  const res = await apiRequest<AuthPayload>('/auth/login', {
    method: 'POST',
    body: input,
    skipAuth: true,
  });
  await persistAuth(res.data);
  return res.data.user;
}

/** POST /auth/register — persists tokens + captured cookies. */
export async function register(input: RegisterInput): Promise<User> {
  const res = await apiRequest<AuthPayload>('/auth/register', {
    method: 'POST',
    body: input,
    skipAuth: true,
  });
  await persistAuth(res.data);
  return res.data.user;
}

async function persistAuth(data: AuthPayload): Promise<void> {
  // The refresh + csrf cookies are captured inside client.rawRequest via
  // captureAuthCookies for auth routes too, but we explicitly persist the body
  // tokens here so the session is complete even if cookie capture is skipped.
  await sessionStore.set({
    accessToken: data.accessToken,
    csrfToken: data.csrfToken ?? sessionStore.getCsrfToken(),
  });
}

/** POST /auth/logout — sends cookies so the server revokes the session. */
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout', undefined, { withCookies: true, skipAuth: true });
  } catch {
    /* best-effort; local session is cleared regardless */
  } finally {
    await sessionStore.clear();
  }
}

/** GET /auth/me — current user. */
export async function getMe(): Promise<User> {
  const data = await api.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email }, { skipAuth: true });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password }, { skipAuth: true });
}

export async function verifyEmail(token: string): Promise<void> {
  await api.post('/auth/verify-email', { token }, { skipAuth: true });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/change-password', { currentPassword, newPassword });
}

export { ApiError };
