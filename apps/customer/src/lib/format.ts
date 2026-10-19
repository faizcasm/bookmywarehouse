/** Formatting helpers — money (minor units), dates and status → badge mappings. */

import type { PricingPeriod } from './types';

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

export function formatNumber(value?: number | null, maximumFractionDigits = 1): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits }).format(value);
}

export function formatPercent(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${formatNumber(value, 1)}%`;
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
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} → ${formatDate(end)}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDaysOfWeek(days: number[]): string {
  if (!days || days.length === 0) return 'Every day';
  if (days.length === 7) return 'Every day';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join(',') === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join(',') === '0,6') return 'Weekends';
  return sorted.map((day) => DAY_NAMES[day] ?? String(day)).join(', ');
}

/* -------------------------- labels & badges -------------------------- */

const PERIOD_WORDS: Record<PricingPeriod, string> = {
  HOUR: 'hour',
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
};

export function periodWord(period?: PricingPeriod | string | null): string {
  if (!period) return '';
  return PERIOD_WORDS[period as PricingPeriod] ?? String(period).toLowerCase();
}

export function humanize(value?: string | null): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'accent';

export interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

const BOOKING_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING_APPROVAL: { label: 'Pending approval', tone: 'warn' },
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  REFUND_PENDING: { label: 'Refund pending', tone: 'warn' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  DISPUTED: { label: 'Disputed', tone: 'danger' },
};

export function bookingStatusMeta(status?: string | null): StatusMeta {
  if (!status) return { label: 'Unknown', tone: 'neutral' };
  return BOOKING_STATUS_META[status] ?? { label: humanize(status), tone: 'neutral' };
}

const INVOICE_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  ISSUED: { label: 'Issued', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  VOID: { label: 'Void', tone: 'danger' },
  REFUNDED: { label: 'Refunded', tone: 'warn' },
};

export function invoiceStatusMeta(status?: string | null): StatusMeta {
  if (!status) return { label: 'Unknown', tone: 'neutral' };
  return INVOICE_STATUS_META[status] ?? { label: humanize(status), tone: 'neutral' };
}

const DISPUTE_STATUS_META: Record<string, StatusMeta> = {
  OPEN: { label: 'Open', tone: 'warn' },
  UNDER_REVIEW: { label: 'Under review', tone: 'info' },
  RESOLVED_CUSTOMER: { label: 'Resolved (customer)', tone: 'success' },
  RESOLVED_PARTNER: { label: 'Resolved (partner)', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
};

export function disputeStatusMeta(status?: string | null): StatusMeta {
  if (!status) return { label: 'Unknown', tone: 'neutral' };
  return DISPUTE_STATUS_META[status] ?? { label: humanize(status), tone: 'neutral' };
}

const VERIFICATION_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { label: 'Not submitted', tone: 'neutral' },
  SUBMITTED: { label: 'Submitted', tone: 'info' },
  UNDER_REVIEW: { label: 'Under review', tone: 'info' },
  VERIFIED: { label: 'Verified', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
};

export function verificationStatusMeta(status?: string | null): StatusMeta {
  if (!status) return { label: 'Unknown', tone: 'neutral' };
  return VERIFICATION_STATUS_META[status] ?? { label: humanize(status), tone: 'neutral' };
}

const PAYMENT_STATUS_META: Record<string, StatusMeta> = {
  PENDING: { label: 'Pending', tone: 'warn' },
  PROCESSING: { label: 'Processing', tone: 'info' },
  SUCCEEDED: { label: 'Succeeded', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  PARTIALLY_REFUNDED: { label: 'Partially refunded', tone: 'warn' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export function paymentStatusMeta(status?: string | null): StatusMeta {
  if (!status) return { label: 'Unknown', tone: 'neutral' };
  return PAYMENT_STATUS_META[status] ?? { label: humanize(status), tone: 'neutral' };
}

export type StatusKind = 'booking' | 'invoice' | 'dispute' | 'verification' | 'payment';

export function statusMetaFor(kind: StatusKind, status?: string | null): StatusMeta {
  switch (kind) {
    case 'booking':
      return bookingStatusMeta(status);
    case 'invoice':
      return invoiceStatusMeta(status);
    case 'dispute':
      return disputeStatusMeta(status);
    case 'verification':
      return verificationStatusMeta(status);
    case 'payment':
      return paymentStatusMeta(status);
    default:
      return { label: humanize(status), tone: 'neutral' };
  }
}

export const LISTING_TYPE_LABELS: Record<string, string> = {
  WAREHOUSE: 'Warehouse',
  EQUIPMENT: 'Equipment',
  SERVICE: 'Service',
};

export function listingTypeLabel(type?: string | null): string {
  if (!type) return '';
  return LISTING_TYPE_LABELS[type] ?? humanize(type);
}
