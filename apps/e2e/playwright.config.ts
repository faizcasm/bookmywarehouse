import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

/** Vite cold-starts and the API boots tsx watch — give each server room. */
const SERVER_TIMEOUT_MS = 120_000;

/**
 * End-to-end suite for BookMyWarehouse.
 *
 * Scenarios (see BookMyWarehouse_Master_AI_Build_Prompt.md → "End-to-end tests"):
 *   1  customer registers + searches            (tests/scenario-01-*.spec.ts)
 *   2  customer submits a booking request       (tests/scenario-02-05-*.spec.ts)
 *   3  partner receives + accepts the request   (tests/scenario-02-05-*.spec.ts)
 *   4  booking status reaches CONFIRMED         (tests/scenario-02-05-*.spec.ts)
 *   5  customer booking details page            (tests/scenario-02-05-*.spec.ts)
 *   6  admin verifies a partner                 (tests/scenario-06-07-*.spec.ts)
 *   7  admin approves/rejects a listing         (tests/scenario-06-07-*.spec.ts)
 *   8  unauthorized access is blocked           (tests/scenario-08-*.spec.ts)
 *   9  overlapping bookings respect capacity        (tests/scenario-09-10-*.spec.ts)
 *  10  duplicate webhooks are idempotent            (tests/scenario-09-10-*.spec.ts)
 *
 * Workers is 1 on purpose: the scenarios share one API/DB state, and files
 * rely on seed data only (each run creates its own listings/bookings/users).
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  forbidOnly: !!process.env.CI,
  use: {
    trace: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @bmw/api dev',
      cwd: repoRoot,
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: SERVER_TIMEOUT_MS,
      // Generous limits so consecutive E2E runs never trip the auth limiter.
      env: {
        ...process.env,
        RATE_LIMIT_API_MAX: '5000',
        RATE_LIMIT_AUTH_MAX: '1000',
        RATE_LIMIT_AUTH_WINDOW_MIN: '15',
        RATE_LIMIT_SENSITIVE_MAX: '1000',
      },
    },
    {
      command: 'pnpm --filter @bmw/customer dev',
      cwd: repoRoot,
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: SERVER_TIMEOUT_MS,
    },
    {
      command: 'pnpm --filter @bmw/partner dev',
      cwd: repoRoot,
      url: 'http://localhost:5174',
      reuseExistingServer: true,
      timeout: SERVER_TIMEOUT_MS,
    },
    {
      command: 'pnpm --filter @bmw/admin dev',
      cwd: repoRoot,
      url: 'http://localhost:5175',
      reuseExistingServer: true,
      timeout: SERVER_TIMEOUT_MS,
    },
  ],
});
