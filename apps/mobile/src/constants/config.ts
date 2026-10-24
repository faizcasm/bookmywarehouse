/**
 * App-wide configuration, read from Expo's public environment variables.
 *
 * EXPO_PUBLIC_* vars are inlined at build time and are safe to ship in the
 * client bundle (no secrets). The API base URL is the only required value.
 */

import { Platform } from 'react-native';

/** Default API base per platform for local development against `pnpm dev`. */
const DEV_BASE: Record<string, string> = {
  android: 'http://10.0.2.2:4000/api/v1', // Android emulator reaches host via 10.0.2.2
  ios: 'http://localhost:4000/api/v1',
  default: 'http://localhost:4000/api/v1',
};

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Normalise an API base URL to always end in `/api/v1` exactly once.
 *
 * Accepts either an origin (`https://api.example.com`) or a full base
 * (`https://api.example.com/api/v1`), so config can't silently produce 404s
 * by omitting the version prefix. Idempotent and strips any trailing slash.
 */
function withVersionPrefix(raw: string): string {
  const trimmed = raw.replace(/\/+$/, '');
  return /\/api\/v1$/.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

/** Base URL for every API call, without a trailing slash. */
export const API_BASE: string = withVersionPrefix(
  envApiUrl ?? (isDev ? DEV_BASE[Platform.OS] ?? DEV_BASE.default! : 'https://bookmywarehouse.vercel.app/api/v1'),
);

/** Origin (no /api/v1) used for the /health probe. */
export const API_ORIGIN: string = API_BASE.replace(/\/api\/v1$/, '');

/** Request timeout in milliseconds. */
export const REQUEST_TIMEOUT_MS = 15000;

/** Default page size for paginated list endpoints. */
export const DEFAULT_PAGE_SIZE = 20;

/** Polling interval (ms) for conversation threads. */
export const MESSAGE_POLL_MS = 15000;

/** App display constants. */
export const APP_NAME = 'BookMyWarehouse';

/** AsyncStorage keys (non-sensitive preferences only). */
export const STORAGE_KEYS = {
  theme: 'bmw-theme',
  lastCity: 'bmw-last-city',
} as const;
