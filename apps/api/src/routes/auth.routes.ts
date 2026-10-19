import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authLimiter } from '../middleware/rate-limit.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '@bmw/validation';
import {
  registerHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  verifyEmailHandler,
  changePasswordHandler,
  updateProfileHandler,
  meHandler,
  bootstrapInfoHandler,
} from '../controllers/auth.controller.js';

const noBody = z.object({}).passthrough();

/**
 * Authentication routes (/api/v1/auth).
 */
export function authRoutes(): Router {
  const router = Router();

  // Bootstrap info for the frontends (app URLs, email provider mode).
  router.get('/bootstrap', asyncHandler(bootstrapInfoHandler));

  // Credential endpoints are rate-limited to slow brute force.
  router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(registerHandler));
  router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(loginHandler));
  router.post(
    '/forgot-password',
    authLimiter,
    validate({ body: forgotPasswordSchema }),
    asyncHandler(forgotPasswordHandler),
  );
  router.post(
    '/reset-password',
    authLimiter,
    validate({ body: resetPasswordSchema }),
    asyncHandler(resetPasswordHandler),
  );
  router.post('/verify-email', validate({ body: verifyEmailSchema }), asyncHandler(verifyEmailHandler));

  // Cookie rotation (httpOnly refresh cookie + CSRF double-submit).
  router.post('/refresh', authLimiter, validate({ body: noBody }), asyncHandler(refreshHandler));
  router.post('/logout', validate({ body: noBody }), asyncHandler(logoutHandler));

  // Session endpoints (any authenticated user).
  router.get('/me', requireAuth, asyncHandler(meHandler));
  router.patch('/me', requireAuth, validate({ body: updateProfileSchema }), asyncHandler(updateProfileHandler));
  router.post(
    '/change-password',
    requireAuth,
    validate({ body: changePasswordSchema }),
    asyncHandler(changePasswordHandler),
  );

  // Admin-only helper endpoint (used by the admin app to verify access).
  router.get('/admin-ping', requireAuth, requireRole('ADMIN'), (req, res) => {
    res.json({ success: true, data: { ok: true, userId: req.auth?.userId }, requestId: req.requestId });
  });

  // Optional-auth sanity endpoint (kept for client bootstrapping).
  router.get('/session', optionalAuth, (req, res) => {
    res.json({ success: true, data: { authenticated: Boolean(req.auth), role: req.auth?.role ?? null } });
  });

  return router;
}
