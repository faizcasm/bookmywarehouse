import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// Load .env from the closest ancestor directory (repo root or app root) so the
// API works whether it is started from the workspace root or apps/api.
function loadEnvFile(): void {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate });
      return;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  loadDotenv();
}
loadEnvFile();

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1');

const devSecret = (name: string): string =>
  `dev-insecure-${name}-replace-before-production-0000000000`;

/**
 * True when the process is running on a deployment platform. `NODE_ENV` is a
 * single typo away from being wrong, but these platform variables are injected
 * by the host and cannot be "forgot" — so they are a stronger production signal
 * than NODE_ENV alone.
 */
const isHostedEnvironment =
  process.env.VERCEL === '1' ||
  process.env.VERCEL === 'true' ||
  process.env.RENDER !== undefined ||
  process.env.RAILWAY_ENVIRONMENT !== undefined ||
  process.env.HEROKU_APP_NAME !== undefined ||
  process.env.AWS_EXECUTION_ENV !== undefined;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  CUSTOMER_APP_URL: z.string().url().default('http://localhost:5173'),
  PARTNER_APP_URL: z.string().url().default('http://localhost:5174'),
  ADMIN_APP_URL: z.string().url().default('http://localhost:5175'),
  CORS_ORIGINS: z.string().optional(),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  ACCESS_TOKEN_SECRET: z.string().min(32).optional(),
  REFRESH_TOKEN_SECRET: z.string().min(32).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),

  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('BookMyWarehouse <no-reply@bookmywarehouse.dev>'),
  EMAIL_PROVIDER: z.enum(['resend', 'none']).default('none'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  PAYMENT_PROVIDER: z.enum(['SANDBOX', 'RAZORPAY', 'STRIPE']).default('SANDBOX'),
  PAYMENT_PUBLIC_KEY: z.string().optional(),
  PAYMENT_SECRET_KEY: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  TRUST_PROXY: booleanish.default(false),
  MAX_IMAGE_INLINE_BYTES: z.coerce.number().int().min(10_000).max(2_000_000).default(400_000),

  // Rate limits (overridable so E2E/local runs are not throttled; production keeps the defaults).
  RATE_LIMIT_API_MAX: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(20),
  RATE_LIMIT_AUTH_WINDOW_MIN: z.coerce.number().int().min(1).default(15),
  RATE_LIMIT_SENSITIVE_MAX: z.coerce.number().int().min(1).default(20),
});

export type AppEnv = z.infer<typeof envSchema>;

function buildEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    const message = `Invalid environment configuration:\n${issues}\n\nSee .env.example for the required variables.`;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }
    // Development/test convenience: fill obvious gaps so the API can boot with
    // actionable warnings instead of a hard failure. Never on a host, though:
    // a mis-set NODE_ENV there would otherwise ship publicly known secrets.
    if (isHostedEnvironment) {
      throw new Error(
        `${message}\n\nRefusing to fall back to development secrets on a deployment platform. ` +
          'Set ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, SESSION_SECRET and PAYMENT_WEBHOOK_SECRET ' +
          'to random values of at least 32 characters.',
      );
    }
    const fallbacks: Record<string, string> = {
      ACCESS_TOKEN_SECRET: devSecret('access'),
      REFRESH_TOKEN_SECRET: devSecret('refresh'),
      SESSION_SECRET: devSecret('session'),
      PAYMENT_WEBHOOK_SECRET: devSecret('webhook'),
    };
    for (const [key, value] of Object.entries(fallbacks)) {
      if (!process.env[key]) {
        process.env[key] = value;
        console.warn(`[env] ${key} was missing; using an insecure development fallback.`);
      }
    }
    if (!process.env.MONGODB_URI) {
      throw new Error(message);
    }
    const retry = envSchema.safeParse(process.env);
    if (!retry.success) {
      throw new Error(
        `Invalid environment configuration:\n${retry.error.issues
          .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('\n')}`,
      );
    }
    return enforceProductionRequirements(retry.data);
  }
  return enforceProductionRequirements(parsed.data);
}

/**
 * Production guardrails: auth secrets are mandatory (no silent dev fallbacks)
 * and missing optional integrations warn loudly at boot — loudly, but never
 * fatally, so a deploy cannot brick because a payment/email key is absent.
 */
function enforceProductionRequirements(data: AppEnv): AppEnv {
  if (data.NODE_ENV !== 'production') return data;

  const requiredSecrets = ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET', 'SESSION_SECRET'] as const;
  const missing: string[] = requiredSecrets.filter((key) => !data[key]);
  // Webhook signatures are the only auth on the webhook route — a predictable
  // dev-derived secret would let anyone forge "payment succeeded" events.
  if (!data.PAYMENT_WEBHOOK_SECRET) missing.push('PAYMENT_WEBHOOK_SECRET');
  if (missing.length > 0) {
    throw new Error(
      `Missing required production secrets: ${missing.join(', ')}. ` +
        'Set each to a random value of at least 32 characters in the deployment environment.',
    );
  }

  // Belt and braces: a secret that is still the known development placeholder
  // (e.g. copied from a local .env) would let anyone mint admin tokens.
  const isPlaceholder = (value: string | undefined): boolean => Boolean(value?.startsWith('dev-insecure-'));
  const placeholderSecrets = [
    ...requiredSecrets.filter((key) => isPlaceholder(data[key])),
    ...(isPlaceholder(data.PAYMENT_WEBHOOK_SECRET) ? ['PAYMENT_WEBHOOK_SECRET'] : []),
  ];
  if (placeholderSecrets.length > 0) {
    throw new Error(
      `These secrets still hold the development placeholder value: ${placeholderSecrets.join(', ')}. ` +
        'Replace each with a random value of at least 32 characters.',
    );
  }

  const warnings: string[] = [];
  if (data.PAYMENT_PROVIDER === 'SANDBOX') {
    warnings.push('PAYMENT_PROVIDER=SANDBOX — checkout is simulated (set PAYMENT_PUBLIC_KEY/PAYMENT_SECRET_KEY + RAZORPAY for live payments).');
  }
  if (!(data.EMAIL_PROVIDER === 'resend' && data.EMAIL_PROVIDER_API_KEY)) {
    warnings.push('EMAIL_PROVIDER is not "resend" — transactional emails are logged, not delivered.');
  }
  if (!(data.CLOUDINARY_CLOUD_NAME && data.CLOUDINARY_API_KEY && data.CLOUDINARY_API_SECRET)) {
    warnings.push('Cloudinary is not configured — image uploads fall back to inline development storage.');
  }
  for (const warning of warnings) {
    console.warn(`[env] production readiness: ${warning}`);
  }
  return data;
}

export const env = buildEnv();

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export function corsOrigins(): string[] {
  const configured = env.CORS_ORIGINS
    ?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const origins = new Set(
    configured ?? [env.CUSTOMER_APP_URL, env.PARTNER_APP_URL, env.ADMIN_APP_URL],
  );
  if (!isProd) {
    origins.add('http://localhost:5173');
    origins.add('http://localhost:5174');
    origins.add('http://localhost:5175');
    origins.add('http://127.0.0.1:5173');
  }
  return [...origins];
}

export const config = {
  access: {
    secret: env.ACCESS_TOKEN_SECRET ?? devSecret('access'),
    ttl: env.ACCESS_TOKEN_TTL,
  },
  refresh: {
    secret: env.REFRESH_TOKEN_SECRET ?? devSecret('refresh'),
    ttlDays: env.REFRESH_TOKEN_TTL_DAYS,
  },
  payment: {
    provider: env.PAYMENT_PROVIDER,
    webhookSecret: env.PAYMENT_WEBHOOK_SECRET ?? devSecret('webhook'),
    secretKey: env.PAYMENT_SECRET_KEY,
    publicKey: env.PAYMENT_PUBLIC_KEY,
  },
  email: {
    provider: env.EMAIL_PROVIDER,
    apiKey: env.EMAIL_PROVIDER_API_KEY,
    from: env.EMAIL_FROM,
  },
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    enabled: Boolean(
      env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
    ),
  },
} as const;
