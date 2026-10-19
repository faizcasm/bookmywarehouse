import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['x-request-id'];
  req.requestId =
    typeof header === 'string' && /^[\w-]{1,64}$/.test(header) ? header : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
