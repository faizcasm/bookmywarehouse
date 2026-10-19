import 'dotenv/config';
import { startServer } from './app.js';
import { logger } from './lib/logger.js';

async function main(): Promise<void> {
  const { close } = await startServer();

  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down...`);
    void close().then(
      () => process.exit(0),
      (err) => {
        logger.error('Error during shutdown', err);
        process.exit(1);
      },
    );
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { err: err.message, stack: err.stack });
  });
}

void main().catch((err) => {
  logger.error('Fatal error starting server', err);
  process.exit(1);
});
