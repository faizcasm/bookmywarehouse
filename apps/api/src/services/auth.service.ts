import type { Role } from '@bmw/shared-types';
import type { LoginInput, RegisterInput } from '@bmw/validation';
import { env, config } from '../config/env.js';
import { hashPassword, hashToken, randomToken, verifyPassword } from '../lib/crypto.js';
import { errors } from '../lib/errors.js';
import { signAccessToken } from '../lib/jwt.js';
import {
  CustomerProfile,
  PartnerProfile,
  RefreshToken,
  User,
  type RefreshTokenFields,
  type UserDocument,
  type UserFields,
} from '../models/index.js';
import { recordAudit } from './audit.service.js';
import { notify } from './notification.service.js';
import { renderSimpleEmail, sendEmail } from './email.service.js';
import { logger } from '../lib/logger.js';

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface SessionResult {
  user: UserFields & { _id: unknown };
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  csrfToken: string;
}

const REFRESH_COOKIE = 'bmw_rt';
const CSRF_COOKIE = 'bmw_csrf';

function refreshTtlMs(): number {
  return config.refresh.ttlDays * 24 * 60 * 60 * 1000;
}

async function createSession(
  user: UserDocument,
  ctx: RequestContext,
): Promise<Omit<SessionResult, 'user'>> {
  const rawRefresh = randomToken(48);
  const csrfToken = randomToken(24);
  const expiresAt = new Date(Date.now() + refreshTtlMs());
  const doc = await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(rawRefresh),
    expiresAt,
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent?.slice(0, 300) ?? null,
  });
  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role,
    email: user.email,
    sid: String(doc._id),
  });
  return { accessToken, refreshToken: rawRefresh, refreshTokenExpiresAt: expiresAt, csrfToken };
}

export function authCookieOptions(maxAgeMs: number, httpOnly = true) {
  return {
    httpOnly,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeMs,
  };
}

export const refreshCookiePath = '/api/v1/auth';
export { REFRESH_COOKIE, CSRF_COOKIE };

export async function register(
  input: RegisterInput,
  ctx: RequestContext,
): Promise<SessionResult> {
  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) throw errors.emailTaken();

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    email: input.email,
    passwordHash,
    name: input.name,
    role: input.role,
    phone: input.phone ?? null,
  });

  if (user.role === 'PARTNER') {
    await PartnerProfile.create({
      user: user._id,
      businessName: input.businessName?.trim() || `${input.name}'s business`,
      verificationStatus: 'DRAFT',
    });
  } else {
    await CustomerProfile.create({ user: user._id });
  }

  const verificationToken = randomToken(24);
  user.emailVerificationTokenHash = hashToken(verificationToken);
  user.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  const session = await createSession(user, ctx);

  await sendEmail({
    to: user.email,
    subject: 'Verify your BookMyWarehouse account',
    html: renderSimpleEmail({
      heading: `Welcome, ${user.name}`,
      body: 'Confirm your email address to activate your BookMyWarehouse account.',
      actionLabel: 'Verify email',
      actionUrl: `${env.API_BASE_URL.replace('/api/v1', '')}/verify-email?token=${verificationToken}`,
    }),
    text: `Verify your account: ${env.API_BASE_URL}/auth/verify-email?token=${verificationToken}`,
  });

  await recordAudit({
    actorId: String(user._id),
    action: 'auth.register',
    entityType: 'User',
    entityId: String(user._id),
    summary: `New ${user.role.toLowerCase()} registered`,
    ip: ctx.ip ?? null,
  });

  await notify({
    userId: String(user._id),
    type: 'ACCOUNT_REGISTERED',
    title: 'Welcome to BookMyWarehouse',
    body: 'Your account is ready. Verify your email to unlock bookings.',
    link: '/dashboard/profile',
  });

  const fresh = await User.findById(user._id).lean();
  return {
    user: (fresh ?? (user.toObject() as unknown)) as UserFields & { _id: unknown },
    ...session,
  };
}

export async function login(input: LoginInput, ctx: RequestContext): Promise<SessionResult> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  if (!user) throw errors.invalidCredentials();
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    await recordAudit({
      actorId: String(user._id),
      action: 'auth.login_failed',
      entityType: 'User',
      entityId: String(user._id),
      summary: 'Invalid password',
      ip: ctx.ip ?? null,
    });
    throw errors.invalidCredentials();
  }
  if (user.status === 'SUSPENDED') throw errors.accountSuspended();
  if (user.status === 'DEACTIVATED') throw errors.forbidden('This account is deactivated');

  user.lastLoginAt = new Date();
  await user.save();

  const session = await createSession(user, ctx);
  await recordAudit({
    actorId: String(user._id),
    action: 'auth.login',
    entityType: 'User',
    entityId: String(user._id),
    summary: 'Successful login',
    ip: ctx.ip ?? null,
  });

  const plain = user.toObject() as unknown as UserFields & { _id: unknown };
  return { user: plain, ...session };
}

export async function refresh(rawToken: string | undefined, ctx: RequestContext): Promise<SessionResult> {
  if (!rawToken) throw errors.unauthenticated('Missing refresh token');
  const tokenHash = hashToken(rawToken);
  const stored = await RefreshToken.findOne({ tokenHash }).populate<{ user: UserDocument }>('user');
  if (!stored) throw errors.unauthenticated('Invalid refresh token');
  if (stored.revokedAt) {
    // Reuse of a rotated token: assume theft and revoke every session.
    await RefreshToken.updateMany({ user: stored.user._id }, { revokedAt: new Date() });
    await recordAudit({
      actorId: String(stored.user._id),
      action: 'auth.refresh_reuse_detected',
      entityType: 'Session',
      entityId: String(stored._id),
      summary: 'Revoked all sessions after refresh token reuse',
      ip: ctx.ip ?? null,
    });
    throw errors.unauthenticated('Session was revoked, please sign in again');
  }
  if (stored.expiresAt.getTime() < Date.now()) throw errors.unauthenticated('Session expired');

  const user = stored.user;
  if (!user) throw errors.unauthenticated('Account no longer exists');
  if (user.status !== 'ACTIVE') throw errors.accountSuspended();

  const session = await createSession(user, ctx);
  stored.revokedAt = new Date();
  stored.replacedByHash = hashToken(session.refreshToken);
  await stored.save();
  return { user: user.toObject() as unknown as UserFields & { _id: unknown }, ...session };
}

export async function logout(rawToken: string | undefined, userId?: string): Promise<void> {
  if (rawToken) {
    await RefreshToken.updateOne(
      { tokenHash: hashToken(rawToken) },
      { revokedAt: new Date() },
    );
  }
  if (userId) {
    await recordAudit({
      actorId: userId,
      action: 'auth.logout',
      entityType: 'User',
      entityId: userId,
      summary: 'User signed out',
    });
  }
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}

export async function forgotPassword(email: string, ctx: RequestContext): Promise<void> {
  const user = await User.findOne({ email });
  if (!user) return; // Do not reveal whether the account exists
  const token = randomToken(24);
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();
  await sendEmail({
    to: user.email,
    subject: 'Reset your BookMyWarehouse password',
    html: renderSimpleEmail({
      heading: 'Password reset requested',
      body: 'Use the button below to choose a new password. The link expires in 1 hour.',
      actionLabel: 'Reset password',
      actionUrl: `${env.CUSTOMER_APP_URL}/reset-password?token=${token}`,
    }),
    text: `Reset link: ${env.CUSTOMER_APP_URL}/reset-password?token=${token}`,
  });
  await recordAudit({
    actorId: String(user._id),
    action: 'auth.forgot_password',
    entityType: 'User',
    entityId: String(user._id),
    summary: 'Password reset email requested',
    ip: ctx.ip ?? null,
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const tokenHash = hashToken(token);
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordResetTokenHash');
  if (!user) throw errors.badRequest('Reset link is invalid or has expired');
  user.passwordHash = await hashPassword(password);
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();
  await revokeAllSessions(String(user._id));
  await recordAudit({
    actorId: String(user._id),
    action: 'auth.password_reset',
    entityType: 'User',
    entityId: String(user._id),
    summary: 'Password reset completed',
  });
}

export async function verifyEmail(token: string): Promise<UserFields & { _id: unknown }> {
  const tokenHash = hashToken(token);
  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiresAt: { $gt: new Date() },
  }).select('+emailVerificationTokenHash');
  if (!user) throw errors.badRequest('Verification link is invalid or has expired');
  user.emailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpiresAt = null;
  await user.save();
  await notify({
    userId: String(user._id),
    type: 'EMAIL_VERIFIED',
    title: 'Email verified',
    body: 'Your email address has been confirmed.',
    link: '/dashboard',
  });
  return user.toObject() as unknown as UserFields & { _id: unknown };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw errors.notFound('Account not found');
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw errors.badRequest('Current password is incorrect');
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await recordAudit({
    actorId: userId,
    action: 'auth.change_password',
    entityType: 'User',
    entityId: userId,
    summary: 'Password changed',
  });
}

export type { RefreshTokenFields };
export const sessionCount = async (userId: string): Promise<number> =>
  RefreshToken.countDocuments({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } });

export { logger };
