import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PageMeta } from '@bmw/shared-types';

export interface AuthContext {
  userId: string;
  role: 'CUSTOMER' | 'PARTNER' | 'ADMIN';
  email: string;
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      requestId: string;
    }
  }
}

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

/** Wraps async route handlers so rejected promises reach the error middleware. */
export function asyncHandler(handler: Handler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export interface SuccessOptions {
  meta?: Record<string, unknown>;
  status?: number;
}

export function sendSuccess<T>(res: Response, data: T, options?: SuccessOptions): void {
  res.status(options?.status ?? 200).json({
    success: true,
    data,
    ...(options?.meta ? { meta: options.meta } : {}),
    requestId: res.req.requestId,
  });
}

export function buildPageMeta(
  page: number,
  limit: number,
  total: number,
): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip || '';
}
