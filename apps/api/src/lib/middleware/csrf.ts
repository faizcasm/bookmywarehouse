import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { safeEqual } from '../crypto.js';
import { errors } from '../errors.js';

/**
 * Double-submit CSRF protection for the cookie-based refresh endpoint.
 * The refresh token lives in an httpOnly cookie, so state-changing auth calls
 * must present a matching readable CSRF token in a header.
 */
export const csrfProtection: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const cookieToken = req.cookies?.bmw_csrf as string | undefined;
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || typeof headerToken !== 'string' || !safeEqual(cookieToken, headerToken)) {
    return next(errors.forbidden('Missing or invalid CSRF token'));
  }
  next();
};
