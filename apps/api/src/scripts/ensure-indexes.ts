import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from '../lib/logger.js';
import * as allModels from '../models/index.js';

interface Syncable {
  modelName: string;
  syncIndexes: () => Promise<unknown>;
}

function isModel(entry: unknown): boolean {
  const kind = typeof entry;
  return (
    (kind === 'object' || kind === 'function') &&
    entry !== null &&
    typeof (entry as { syncIndexes?: unknown }).syncIndexes === 'function' &&
    typeof (entry as { modelName?: unknown }).modelName === 'string'
  );
}

/**
 * Ensures every declared Mongoose index exists in the target database.
 * Run: pnpm db:indexes
 */
async function main(): Promise<void> {
  await connectDatabase();

  const entries = Object.entries(allModels) as Array<[string, unknown]>;
  const models = entries.filter((entry): entry is [string, Syncable] => isModel(entry[1]));

  for (const [, model] of models) {
    const changed = (await model.syncIndexes()) as unknown;
    logger.info(`synced indexes for ${model.modelName}`, {
      changed: Array.isArray(changed) ? changed.length : 0,
    });
  }

  await disconnectDatabase();
  logger.info('Index sync complete', { models: models.length });
}

void main().catch((err) => {
  logger.error('Index sync failed', { err: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});
