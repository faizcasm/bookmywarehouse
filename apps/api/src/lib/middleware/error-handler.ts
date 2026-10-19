import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { isAppError } from '../errors.js';
import { logger } from '../logger.js';
import { isProd } from '../../config/env.js';

function zodIssues(error: ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isAppError(error)) {
    if (error.statusCode >= 500) {
      logger.error('Request failed', {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        code: error.code,
        message: error.message,
      });
    }
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.issues ? { issues: error.issues } : {}),
      },
      requestId: req.requestId,
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        issues: zodIssues(error),
      },
      requestId: req.requestId,
    });
    return;
  }

  const anyError = error as { status?: number; statusCode?: number; message?: string };
  const status = anyError?.statusCode ?? anyError?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: anyError.message ?? 'Bad request' },
      requestId: req.requestId,
    });
    return;
  }

  logger.error('Unhandled error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    message: error instanceof Error ? error.message : String(error),
    stack: isProd ? undefined : error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Our team has been notified.',
    },
    requestId: req.requestId,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    requestId: req.requestId,
  });
}

/** Helper used by controllers to parse untrusted input with a Zod schema. */
export function parseWith<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
