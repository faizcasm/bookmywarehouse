import type { NextFunction, Request, Response } from 'express';
import { logger } from '../logger.js';
import { isTest } from '../../config/env.js';

/** Endpoints logged on every request would drown the signal; keep probes quiet. */
const QUIET_PATHS = [/^\/health$/, /^\/api\/v1\/docs/, /^\/api\/v1\/openapi\.json$/];

/**
 * One structured line per completed request (method, path, status, latency,
 * requester id). Without it, only failures are visible in production — you can
 * see that something broke but not what a client actually called or how slow it
 * was. Runs on `res.finish` so it also records requests that error out.
 */
export function accessLog(req: Request, res: Response, next: NextFunction): void {
  if (isTest) return next();
  if (QUIET_PATHS.some((pattern) => pattern.test(req.path))) return next();

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const status = res.statusCode;
    const payload = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: req.auth?.userId,
      role: req.auth?.role,
    };
    if (status >= 500) logger.error('request', payload);
    else if (status >= 400) logger.warn('request', payload);
    else logger.info('request', payload);
  });
  next();
}
