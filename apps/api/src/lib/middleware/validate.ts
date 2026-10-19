import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { asyncHandler } from '../http.js';

interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates and replaces req.body / req.query / req.params with the parsed
 * (transformed) values so downstream code only sees typed, normalized input.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params);
      if (!parsed.success) throw parsed.error;
      Object.assign(req.params, parsed.data);
    }
    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query);
      if (!parsed.success) throw parsed.error;
      (req as Request & { validatedQuery: unknown }).validatedQuery = parsed.data;
      // Express 5 freezes req.query; assign via defineProperty-safe setter for v4 too.
      Object.defineProperty(req, 'query', { value: parsed.data, writable: true });
    }
    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body ?? {});
      if (!parsed.success) throw parsed.error;
      req.body = parsed.data;
    }
    next();
  });
}

export function validatedQuery<T>(req: Request): T {
  return (req as Request & { validatedQuery: T }).validatedQuery;
}
