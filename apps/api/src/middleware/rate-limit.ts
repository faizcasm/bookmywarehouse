import type { RequestHandler } from 'express';
import rateLimitFactory from 'express-rate-limit';
import { isTest } from '../config/env.js';

export { apiLimiter, authLimiter, sensitiveLimiter } from '../lib/middleware/rate-limit.js';

/**
 * Ad-hoc rate limiter for individual routes (e.g. credential endpoints).
 * Disabled automatically when NODE_ENV=test so tests are not flaky.
 */
export function rateLimit(options?: { windowMs?: number; max?: number; message?: string }): RequestHandler {
  return rateLimitFactory({
    windowMs: options?.windowMs ?? 60_000,
    limit: options?.max ?? 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTest,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: options?.message ?? 'Too many requests, please slow down.',
      },
    },
  });
}
