import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { safeEqual } from '../lib/crypto.js';
import { errors } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Paths that must work without a CSRF cookie (pre-session flows) or that are
 * authenticated by signature instead of ambient credentials.
 * /auth/refresh is handled separately: it requires the double-submit token
 * only when the CSRF cookie is actually present.
 */
const EXEMPT_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/verify-email',
  '/api/v1/payments/webhook',
];

function pathOf(req: Request): string {
  return req.originalUrl.split('?')[0] ?? req.path;
}

/**
 * Double-submit CSRF protection.
 *
 * The refresh token lives in an httpOnly cookie, so any request that relies on
 * cookie-based auth must echo the readable `bmw_csrf` cookie in the
 * `X-CSRF-Token` header. Requests without the cookie (pure bearer-token API
 * clients) pass through — there is no ambient credential to abuse.
 */
export const csrfProtection: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const path = pathOf(req);
  if (EXEMPT_PATHS.includes(path)) return next();

  const cookieToken = (req.cookies as Record<string, string> | undefined)?.bmw_csrf;
  if (!cookieToken) return next(); // No ambient credential present.

  const headerToken = req.headers['x-csrf-token'];
  if (typeof headerToken !== 'string' || !safeEqual(cookieToken, headerToken)) {
    return next(errors.forbidden('Missing or invalid CSRF token'));
  }
  next();
};
