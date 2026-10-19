import type { BookingStatus, ListingStatus, VerificationStatus } from './types';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** Money is integer minor units (paise). Display major units. */
export function formatMoney(minor: number | null | undefined, currency = 'INR'): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return '—';
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    });
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(minor / 100);
}

/** Convert a major-unit rupee input (from a form field) to minor units. */
export function toMinor(major: number): number {
  return Math.round(major * 100);
}

/** Convert minor units back to a major-unit number for form inputs. */
export function toMajor(minor: number): number {
  return Math.round(minor) / 100;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${formatNumber(value, 1)}%`;
}

export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDayShort(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date);
}

/** "3 hours ago" / "in 2 days" */
export function relativeTime(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return rtf.format(Math.round(diffMs / 1000), 'second');
  if (minutes < 60) return rtf.format(diffMs / 60_000, 'minute');
  const hours = Math.round(abs / 3_600_000);
  if (hours < 24) return rtf.format(diffMs / 3_600_000, 'hour');
  const days = Math.round(abs / 86_400_000);
  if (days < 30) return rtf.format(diffMs / 86_400_000, 'day');
  const months = Math.round(abs / 2_592_000_000);
  if (months < 12) return rtf.format(diffMs / 2_592_000_000, 'month');
  return rtf.format(diffMs / 31_536_000_000, 'year');
}

/** PENDING_APPROVAL → "Pending approval" */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

const VERIFICATION_TONES: Record<VerificationStatus, Tone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
};

const LISTING_TONES: Record<ListingStatus, Tone> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  PUBLISHED: 'success',
  REJECTED: 'danger',
  UNPUBLISHED: 'neutral',
  SUSPENDED: 'danger',
  ARCHIVED: 'neutral',
};

const BOOKING_TONES: Record<BookingStatus, Tone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  AWAITING_PAYMENT: 'info',
  CONFIRMED: 'success',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  REJECTED: 'danger',
  REFUND_PENDING: 'warning',
  REFUNDED: 'neutral',
  DISPUTED: 'danger',
};

const REVIEW_TONES: Record<string, Tone> = {
  PENDING: 'warning',
  PUBLISHED: 'success',
  HIDDEN: 'neutral',
  REMOVED: 'danger',
};

export type BadgeKind = 'listing' | 'booking' | 'verification' | 'review' | 'generic';

export function statusTone(kind: BadgeKind, status: string): Tone {
  switch (kind) {
    case 'listing':
      return LISTING_TONES[status as ListingStatus] ?? 'neutral';
    case 'booking':
      return BOOKING_TONES[status as BookingStatus] ?? 'neutral';
    case 'verification':
      return VERIFICATION_TONES[status as VerificationStatus] ?? 'neutral';
    case 'review':
      return REVIEW_TONES[status] ?? 'neutral';
    default:
      return 'neutral';
  }
}

/**
 * Notification links are written for the API/other apps (e.g.
 * "/dashboard/messages?conversation=<id>"). Map them onto partner routes;
 * fall back to "/notifications" when unknown.
 */
export function mapNotificationLink(link: string | null | undefined): string {
  if (!link) return '/notifications';
  const conversationMatch = /[?&]conversation=([A-Za-z0-9]+)/.exec(link);
  if (conversationMatch) return `/messages/${conversationMatch[1]}`;
  const path = link.split('?')[0] ?? '';
  if (path.startsWith('/partner/')) return path.slice('/partner'.length) || '/';
  if (path.startsWith('/dashboard/messages')) return '/messages';
  if (path.startsWith('/dashboard/bookings')) return '/bookings';
  if (path.startsWith('/dashboard/listings')) return '/listings';
  if (path.startsWith('/dashboard')) return '/';
  if (path === '/reviews' || path.startsWith('/reviews')) return '/reviews';
  if (path.startsWith('/notifications') || path.startsWith('/bookings') || path.startsWith('/listings') || path.startsWith('/earnings')) {
    return path;
  }
  return '/notifications';
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function daysOfWeekLabels(days: number[]): string {
  if (!days || days.length === 0) return '—';
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d] ?? String(d))
    .join(', ');
}
