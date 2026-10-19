import type { RequestHandler } from 'express';

export {
  authenticate,
  optionalAuth,
  requireAuth,
  requireRole,
} from '../lib/middleware/auth.js';
import { requireRole } from '../lib/middleware/auth.js';

/** Shorthand for routes that only admins may access. */
export const requireAdmin: RequestHandler = requireRole('ADMIN');
