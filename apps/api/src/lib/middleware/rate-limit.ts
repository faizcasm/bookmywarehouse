import rateLimit from 'express-rate-limit';
import { env, isTest } from '../../config/env.js';

const testDisabled = isTest;

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_API_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => testDisabled,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down.' },
  },
});

export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MIN * 60_000,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => testDisabled,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Try again in 15 minutes.',
    },
  },
});

export const sensitiveLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_SENSITIVE_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => testDisabled,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again shortly.' },
  },
});
