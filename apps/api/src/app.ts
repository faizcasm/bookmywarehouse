import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { generateHTML, serve as swaggerServe } from 'swagger-ui-express';

import { corsOrigins, env, isProd } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { logger } from './lib/logger.js';
import { requestIdMiddleware } from './middleware/request-context.js';
import { optionalAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { csrfProtection } from './middleware/csrf.js';

import { authRoutes } from './routes/auth.routes.js';
import { catalogRoutes } from './routes/catalog.routes.js';
import { bookingRoutes } from './routes/booking.routes.js';
import { paymentRoutes } from './routes/payment.routes.js';
import { socialRoutes } from './routes/social.routes.js';
import { partnerRoutes } from './routes/partner.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { healthHandler } from './controllers/catalog.controller.js';
import { openapiSpec } from './docs/openapi.js';

/**
 * Create the Express application (pure: no side effects — easy to test).
 */
export function createApp(): Express {
  const app = express();

  app.set('trust proxy', true);
  app.disable('x-powered-by');

  // Security & performance baselines.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(compression());

  // Per-request id + structured logging context.
  app.use(requestIdMiddleware);

  // CORS for the three local frontends (and any configured origins).
  const origins = new Set(corsOrigins());
  app.use(
    cors({
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      exposedHeaders: ['X-Request-Id'],
      origin(origin, callback) {
        // Non-browser clients (no Origin header) are allowed.
        callback(null, !origin || origins.has(origin));
      },
    }),
  );

  // JSON body parser keeps the raw bytes for webhook signature verification.
  app.use(
    express.json({
      limit: '2mb',
      verify(req, _res, buf) {
        (req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: '2mb' }));
  app.use(cookieParser());

  // Populate req.auth whenever a valid access token is present; individual
  // routes opt into enforcement with requireAuth / requireRole.
  app.use(optionalAuth);

  // Liveness probe (no auth, no DB).
  app.get('/health', asyncHandlerHealth);

  // Public crawler endpoints (sitemap.xml / robots.txt) — no auth, no rate limit,
  // answerable both at the domain root and under /api/ (Vercel API rewrite).
  app.use(publicRoutes());

  // API documentation — public (no auth, no rate limit; GET-only so CSRF passes
  // it through). The HTML route is registered before the static file handlers so
  // the bare /docs path answers 200 instead of a trailing-slash redirect, and an
  // injected <base> keeps swagger-ui's relative assets working at both /docs
  // and /docs/.
  const docsHtml = generateHTML(openapiSpec, { customSiteTitle: 'BookMyWarehouse API Docs' }).replace(
    '<head>',
    '<head><base href="/api/v1/docs/">',
  );
  app.get('/api/v1/docs', (_req, res) => {
    res.type('html').send(docsHtml);
  });
  app.use('/api/v1/docs', ...swaggerServe);
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(openapiSpec);
  });

  // Baseline rate limit + double-submit CSRF for the API surface.
  app.use('/api/', apiLimiter);
  app.use(csrfProtection);

  const api = express.Router();
  api.use('/auth', authRoutes());
  api.use('/catalog', catalogRoutes());
  api.use('/bookings', bookingRoutes());
  api.use('/payments', paymentRoutes());
  api.use('/partner', partnerRoutes());
  api.use('/admin', adminRoutes());
  api.use('/', socialRoutes());
  app.use('/api/v1', api);

  // Unknown API routes → JSON 404.
  app.use('/api', notFoundHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Separate binding so the health handler (async, DB-aware) is wrapped correctly.
function asyncHandlerHealth(req: Request, res: Response, next: NextFunction): void {
  void Promise.resolve(healthHandler(req, res)).catch(next);
}

/**
 * Boot: connect to MongoDB, start listening. Returns a shutdown function.
 */
export async function startServer(): Promise<{ app: Express; close: () => Promise<void> }> {
  await connectDatabase();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (env=${env.NODE_ENV}, prod=${isProd})`);
  });

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
  };

  return { app, close };
}

/**
 * Serverless entry — Vercel invokes `dist/app.js` as the function handler
 * (see `services.api.entrypoint` in the root vercel.json), so the default
 * export here is the (req, res) listener the platform calls per request.
 *
 * The app is created once per cold start after the Mongo handshake; warm
 * invocations reuse the connection cached on globalThis (config/db.ts). On a
 * failed connect the promise resets so a transient outage does not poison
 * every subsequent warm invocation.
 */
let serverlessAppPromise: Promise<Express> | null = null;

function getServerlessApp(): Promise<Express> {
  if (!serverlessAppPromise) {
    serverlessAppPromise = connectDatabase()
      .then(() => createApp())
      .catch((err: unknown) => {
        serverlessAppPromise = null;
        throw err;
      });
  }
  return serverlessAppPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getServerlessApp();
  app(req, res);
}
