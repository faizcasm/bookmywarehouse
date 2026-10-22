import mongoose from 'mongoose';
import { env, isProd } from './env.js';
import { logger } from '../lib/logger.js';

/**
 * Serverless-friendly connection cache: reuse the socket across warm invocations
 * instead of opening a new pool per request.
 */
interface CachedConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalWithMongoose = global as typeof globalThis & { __mongooseConnection?: CachedConnection };
const cache: CachedConnection = globalWithMongoose.__mongooseConnection ?? {
  conn: null,
  promise: null,
};
globalWithMongoose.__mongooseConnection = cache;

mongoose.set('strictQuery', true);

export async function connectDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 10,
        minPoolSize: 0,
        autoIndex: !isProd,
        bufferCommands: false,
      })
      .then((instance) => {
        logger.info('MongoDB connected', { db: instance.connection.name });
        if (isProd) void syncProductionIndexesInBackground();
        return instance;
      });
  }
  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    logger.error('MongoDB connection failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  return cache.conn;
}

/**
 * Production runs `autoIndex: false` (building indexes on boot is slow and can
 * race a deploy), and no deploy step runs `pnpm db:indexes` — so a fresh
 * database would serve every search and list unindexed. Sync once per process,
 * in the background, without ever failing the boot or a request.
 */
let indexSyncDone = false;

async function syncProductionIndexesInBackground(): Promise<void> {
  if (indexSyncDone) return;
  indexSyncDone = true;
  try {
    const models = await import('../models/index.js');
    for (const entry of Object.values(models)) {
      const candidate = entry as { syncIndexes?: () => Promise<unknown>; modelName?: string };
      if (typeof candidate?.syncIndexes !== 'function') continue;
      await candidate.syncIndexes();
    }
    logger.info('MongoDB indexes synced');
  } catch (error) {
    // Non-fatal: the API serves traffic without indexes rather than not at all.
    logger.error('MongoDB index sync failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}

export async function databaseHealth(): Promise<{ connected: boolean; latencyMs: number | null }> {
  const started = Date.now();
  if (mongoose.connection.readyState !== 1) return { connected: false, latencyMs: null };
  try {
    await mongoose.connection.db?.admin().command({ ping: 1 });
    return { connected: true, latencyMs: Date.now() - started };
  } catch {
    return { connected: false, latencyMs: null };
  }
}
