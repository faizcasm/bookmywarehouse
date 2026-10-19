import type { Request, Response } from 'express';
import type {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '@bmw/validation';
import { z } from 'zod';
import { sendSuccess, clientIp } from '../lib/http.js';
import { errors } from '../lib/errors.js';
import {
  CSRF_COOKIE,
  REFRESH_COOKIE,
  authCookieOptions,
  changePassword,
  forgotPassword,
  login,
  logout,
  refresh,
  register,
  resetPassword,
  verifyEmail,
} from '../services/auth.service.js';
import { CustomerProfile, User } from '../models/index.js';
import { serializeUser } from '../serializers/user.serializer.js';
import { env } from '../config/env.js';
import { describeEmailConfig } from '../services/email.service.js';
import { getSettings, toSettingsDTO } from '../services/settings.service.js';
import { serializePartnerProfile } from '../services/partner.service.js';

type Body<T> = z.infer<T>;

function requestContext(req: Request) {
  return { ip: clientIp(req), userAgent: req.headers['user-agent'] ?? null };
}

function setAuthCookies(res: Response, tokens: { refreshToken: string; csrfToken: string }): void {
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...authCookieOptions(REFRESH_COOKIE_TTL_MS),
    httpOnly: true,
    path: '/api/v1/auth',
  });
  res.cookie(CSRF_COOKIE, tokens.csrfToken, {
    ...authCookieOptions(REFRESH_COOKIE_TTL_MS),
    httpOnly: false,
    path: '/',
  });
}

const REFRESH_COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const input = req.body as Body<typeof registerSchema>;
  const result = await register(input, requestContext(req));
  setAuthCookies(res, result);
  sendSuccess(
    res,
    {
      user: serializeUser(result.user),
      accessToken: result.accessToken,
      csrfToken: result.csrfToken,
      emailConfig: describeEmailConfig(),
    },
    { status: 201 },
  );
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const input = req.body as Body<typeof loginSchema>;
  const result = await login(input, requestContext(req));
  setAuthCookies(res, result);
  sendSuccess(res, {
    user: serializeUser(result.user),
    accessToken: result.accessToken,
    csrfToken: result.csrfToken,
  });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await logout(rawToken, req.auth?.userId);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
  sendSuccess(res, { loggedOut: true });
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  const result = await refresh(rawToken, requestContext(req));
  setAuthCookies(res, result);
  sendSuccess(res, {
    user: serializeUser(result.user),
    accessToken: result.accessToken,
    csrfToken: result.csrfToken,
  });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) throw errors.unauthenticated();
  const user = await User.findById(userId).lean();
  if (!user) throw errors.notFound('Account not found');
  const settings = await getSettings();

  let profile: unknown = null;
  if (user.role === 'CUSTOMER') {
    profile = await CustomerProfile.findOne({ user: userId }).lean();
  } else if (user.role === 'PARTNER') {
    profile = await serializePartnerProfile(userId);
  }

  sendSuccess(res, {
    user: serializeUser(user as never),
    profile,
    platform: toSettingsDTO(settings),
  });
}

export async function forgotPasswordHandler(req: Request, res: Response): Promise<void> {
  const input = req.body as Body<typeof forgotPasswordSchema>;
  await forgotPassword(input.email, requestContext(req));
  sendSuccess(res, {
    message: 'If an account exists for that email, a reset link has been sent.',
    emailConfig: describeEmailConfig(),
  });
}

export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  const input = req.body as Body<typeof resetPasswordSchema>;
  await resetPassword(input.token, input.password);
  sendSuccess(res, { message: 'Password updated. You can sign in now.' });
}

export async function verifyEmailHandler(req: Request, res: Response): Promise<void> {
  const input = req.body as Body<typeof verifyEmailSchema>;
  const user = await verifyEmail(input.token);
  sendSuccess(res, { user: serializeUser(user), message: 'Email verified' });
}

export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  const input = req.body as Body<typeof changePasswordSchema>;
  if (!req.auth) throw errors.unauthenticated();
  await changePassword(req.auth.userId, input.currentPassword, input.newPassword);
  sendSuccess(res, { message: 'Password changed' });
}

export async function updateProfileHandler(req: Request, res: Response): Promise<void> {
  const input = req.body as Body<typeof updateProfileSchema>;
  if (!req.auth) throw errors.unauthenticated();
  const user = await User.findById(req.auth.userId);
  if (!user) throw errors.notFound('Account not found');
  if (input.name !== undefined) user.name = input.name;
  if (input.phone !== undefined) user.phone = input.phone ?? null;
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl ?? null;
  await user.save();
  sendSuccess(res, { user: serializeUser(user.toObject() as never) });
}

export async function bootstrapInfoHandler(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, {
    apps: {
      customer: env.CUSTOMER_APP_URL,
      partner: env.PARTNER_APP_URL,
      admin: env.ADMIN_APP_URL,
    },
    email: describeEmailConfig(),
  });
}
