/**
 * Navigation helpers.
 *
 * `next` comes from query params / deep links, so it must never be allowed to
 * send the app to another origin or an unknown screen. Only absolute *in-app*
 * paths are accepted; anything else falls back to the role-appropriate home.
 */

import type { Role } from '@/types';

export const HOME_BY_ROLE: Record<Role | 'GUEST', string> = {
  ADMIN: '/(admin)/(tabs)',
  PARTNER: '/(partner)/(tabs)',
  CUSTOMER: '/(customer)/(tabs)',
  GUEST: '/(customer)/(tabs)',
};

/**
 * Validate a post-login redirect target.
 *
 * Rejects: empty values, relative paths, protocol-relative (`//evil.com`) and
 * absolute URLs (`https://…`). Accepts absolute app paths only.
 */
export function safeNext(raw: string | string[] | undefined, fallback: string): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//')) return fallback;
  if (trimmed.includes('://')) return fallback;
  return trimmed;
}

/** Home route for a role, used when there is no `next`. */
export function homeFor(role: Role | null | undefined): string {
  return HOME_BY_ROLE[(role ?? 'GUEST') as Role | 'GUEST'] ?? HOME_BY_ROLE.GUEST;
}
