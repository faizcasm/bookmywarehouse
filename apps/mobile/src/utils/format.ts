/**
 * Formatting helpers — money (minor units), dates, status → badge tones.
 *
 * Ported from apps/customer/src/lib/format.ts and apps/admin/src/lib/format.ts
 * so the three web consoles and the mobile app agree byte-for-byte on how a
 * status maps to a label and colour (this is a cross-console contract, locked
 * by a test in apps/admin/src/test/format.test.ts).
 */

import type { BadgeTone, StatusMeta } from './badgeTypes';
import type { BookingStatus, PaymentStatus, ListingStatus, VerificationStatus } from '@/types';

export type { BadgeTone, StatusMeta };

/* ------------------------------- money ------------------------------- */

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string): Intl.NumberFormat {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency });
    moneyFormatters.set(currency, formatter);
  }
  return formatter;
}

/** Format an integer amount in minor units (paise) as currency, e.g. 1052560 → "₹10,525.60". */
export function formatMoney(minor?: number | null, currency = 'INR'): string {
  if (minor === undefined || minor === null || Number.isNaN(minor)) return '—';
  return moneyFormatter(currency).format(minor / 100);
}

/** Compact money for stat cards: ₹1.2L / ₹34.5K / ₹1.1Cr. Falls back to full format under ₹1,000. */
export function formatMoneyCompact(minor?: number | null, currency = 'INR'): string {
  if (minor === undefined || minor === null || Number.isNaN(minor)) return '—';
  const abs = Math.abs(minor);
  const symbol = currencySymbol(currency);
  if (abs >= 1_000_000_000) return `${symbol}${(minor / 1_000_000_000).toFixed(1)} Cr`;
  if (abs >= 10_000_000) return `${symbol}${(minor / 10_000_000).toFixed(1)} L`;
  if (abs >= 100_000) return `${symbol}${(minor / 100_000).toFixed(1)} K`;
  return formatMoney(minor, currency);
}

function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en-IN', { style: 'currency', currency }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

export function formatNumber(value?: number | null, maximumFractionDigits = 1): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits }).format(value);
}

export function formatPercent(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${formatNumber(value, 2)}%`;
}

/* ------------------------------- dates ------------------------------- */

function toDate(value?: string | number | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value?: string | number | Date | null): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value?: string | number | Date | null): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatRelativeTime(value?: string | number | Date | null): string {
  const date = toDate(value);
  if (!date) return '—';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function formatDayRange(start?: string | null, end?: string | null): string {
  if (!end || !start || end === start) return formatDate(start);
  return `${formatDate(start)} → ${formatDate(end)}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDaysOfWeek(days: number[]): string {
  if (!days || days.length === 0 || days.length === 7) return 'Every day';
  const sorted = [...days].sort((a, b) => a - b);
  const key = sorted.join(',');
  if (key === '1,2,3,4,5') return 'Weekdays';
  if (key === '0,6') return 'Weekends';
  return sorted.map((day) => DAY_NAMES[day] ?? String(day)).join(', ');
}

export function shortenId(id?: string | null, len = 8): string {
  if (!id) return '—';
  return id.length <= len ? id : `${id.slice(0, len)}…`;
}

export function humanize(value?: string | null): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/* -------------------------- status → tone maps -------------------------- */

export const BOOKING_STATUS_META: Record<BookingStatus, StatusMeta> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING_APPROVAL: { label: 'Pending approval', tone: 'warn' },
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  REFUND_PENDING: { label: 'Refund pending', tone: 'warn' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  DISPUTED: { label: 'Disputed', tone: 'danger' },
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, StatusMeta> = {
  PENDING: { label: 'Pending', tone: 'warn' },
  PROCESSING: { label: 'Processing', tone: 'info' },
  SUCCEEDED: { label: 'Succeeded', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  PARTIALLY_REFUNDED: { label: 'Partially refunded', tone: 'warn' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export const LISTING_STATUS_META: Record<ListingStatus, StatusMeta> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING_REVIEW: { label: 'Pending review', tone: 'warn' },
  PUBLISHED: { label: 'Published', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  UNPUBLISHED: { label: 'Unpublished', tone: 'neutral' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
};

export const VERIFICATION_STATUS_META: Record<VerificationStatus, StatusMeta> = {
  DRAFT: { label: 'Not submitted', tone: 'neutral' },
  SUBMITTED: { label: 'Submitted', tone: 'info' },
  UNDER_REVIEW: { label: 'Under review', tone: 'info' },
  VERIFIED: { label: 'Verified', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
};

const PERIOD_WORDS: Record<string, string> = {
  HOUR: 'hour',
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
};

export function periodWord(period?: string | null): string {
  if (!period) return '';
  return PERIOD_WORDS[period] ?? String(period).toLowerCase();
}
