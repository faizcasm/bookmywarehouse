import type { Express } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';

/**
 * Vercel serverless entry (see vercel.json → services.api.entrypoint).
 *
 * Exports a plain (req, res) request listener instead of calling listen():
 * Vercel invokes it per request on the Node.js runtime. The Mongoose
 * connection is cached on globalThis (see config/db.ts), so warm invocations
 * reuse the pool and only cold starts pay for the handshake.
 */
let appPromise: Promise<Express> | null = null;

function getApp(): Promise<Express> {
  if (!appPromise) {
    // Fail fast on the first request if the DB is unreachable; reset so a
    // transient outage does not poison every subsequent warm invocation.
    appPromise = connectDatabase()
      .then(() => createApp())
      .catch((err: unknown) => {
        appPromise = null;
        throw err;
      });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getApp();
  app(req, res);
}
