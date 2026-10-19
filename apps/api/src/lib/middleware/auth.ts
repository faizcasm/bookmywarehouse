import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@bmw/shared-types';
import { User } from '../../models/user.model.js';
import { errors } from '../errors.js';
import { verifyAccessToken } from '../jwt.js';
import { asyncHandler } from '../http.js';

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

export const authenticate: RequestHandler = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearer(req);
    if (!token) throw errors.unauthenticated();
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub)
      .select('role status emailVerified email')
      .lean();
    if (!user) throw errors.unauthenticated('Account no longer exists');
    if (user.status === 'SUSPENDED') throw errors.accountSuspended();
    if (user.status === 'DEACTIVATED') throw errors.forbidden('This account is deactivated');
    req.auth = {
      userId: String(user._id),
      role: user.role,
      email: user.email,
      sessionId: payload.sid,
    };
    next();
  },
);

/** Attaches auth context when a valid token is present but never rejects. */
export const optionalAuth: RequestHandler = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearer(req);
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        const user = await User.findById(payload.sub).select('role status').lean();
        if (user && user.status === 'ACTIVE') {
          req.auth = {
            userId: String(user._id),
            role: user.role,
            email: payload.email,
            sessionId: payload.sid,
          };
        }
      } catch {
        // Ignore invalid tokens for optional auth.
      }
    }
    next();
  },
);

export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(errors.unauthenticated());
    if (!roles.includes(req.auth.role)) {
      return next(errors.forbidden('Your account does not have access to this resource'));
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(errors.unauthenticated());
  next();
};
