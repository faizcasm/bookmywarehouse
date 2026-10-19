import { env, isTest } from '../config/env.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold: number = isTest
  ? LEVELS.error
  : env.LOG_LEVEL === 'silent'
    ? Number.POSITIVE_INFINITY
    : (LEVELS[env.LOG_LEVEL] ?? LEVELS.info);

/** Fields that must never be written to the log stream. */
const REDACT_KEYS = [
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'secret',
  'cookie',
  'csrfToken',
  'paymentSecretKey',
  'accountNumber',
  'ifsc',
  'panNumber',
  'gstNumber',
];

export interface LogFields {
  [key: string]: unknown;
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.some((key) => k.toLowerCase().includes(key.toLowerCase()))) {
      out[k] = '[redacted]';
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

function write(level: Level, message: string, fields?: LogFields): void {
  if (LEVELS[level] < threshold) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(fields ? (redact(fields) as LogFields) : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields),
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
};

export type Logger = typeof logger;
