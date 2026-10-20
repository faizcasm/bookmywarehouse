/** Money + date formatting and status → badge tone maps. */

export function formatMoney(minor: number | null | undefined, currency = 'INR'): string {
  const value = typeof minor === 'number' && Number.isFinite(minor) ? minor : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

/** Compact money for stat cards: ₹1.2L / ₹34.5K / ₹1.1Cr. Falls back to full format under ₹1,000. */
export function formatMoneyCompact(minor: number | null | undefined, currency = 'INR'): string {
  const value = typeof minor === 'number' && Number.isFinite(minor) ? minor : 0;
  // thresholds are in minor units (paise): ₹1K = 1e5, ₹1L = 1e7, ₹1Cr = 1e9
  const abs = Math.abs(value);
  const symbol = currencySymbol(currency);
  if (abs >= 1_000_000_000) return `${symbol}${(value / 1_000_000_000).toFixed(1)} Cr`;
  if (abs >= 10_000_000) return `${symbol}${(value / 10_000_000).toFixed(1)} L`;
  if (abs >= 100_000) return `${symbol}${(value / 100_000).toFixed(1)} K`;
  return formatMoney(value, currency);
}

function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en-IN', { style: 'currency', currency }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

export function formatNumber(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-IN').format(n);
}

export function formatPercent(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function shortenId(id: string | null | undefined, len = 8): string {
  if (!id) return '—';
  return id.length <= len ? id : `${id.slice(0, len)}…`;
}

/** Compact "just now / 4m ago / 2h ago" label for the notification bell. */
export function formatRelativeTime(value?: string | number | Date | null): string {
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
  if (!date || Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const toneMaps = {
  booking: {
    DRAFT: 'neutral',
    PENDING_APPROVAL: 'warning',
    AWAITING_PAYMENT: 'warning',
    CONFIRMED: 'info',
    IN_PROGRESS: 'accent',
    COMPLETED: 'success',
    CANCELLED: 'neutral',
    REJECTED: 'danger',
    REFUND_PENDING: 'warning',
    REFUNDED: 'info',
    DISPUTED: 'danger',
  } as Record<string, BadgeTone>,
  listing: {
    DRAFT: 'neutral',
    PENDING_REVIEW: 'warning',
    PUBLISHED: 'success',
    REJECTED: 'danger',
    UNPUBLISHED: 'neutral',
    SUSPENDED: 'danger',
    ARCHIVED: 'neutral',
  } as Record<string, BadgeTone>,
  payment: {
    PENDING: 'warning',
    PROCESSING: 'warning',
    SUCCEEDED: 'success',
    FAILED: 'danger',
    REFUNDED: 'info',
    PARTIALLY_REFUNDED: 'info',
    CANCELLED: 'neutral',
  } as Record<string, BadgeTone>,
  refund: {
    PENDING: 'warning',
    PROCESSING: 'warning',
    COMPLETED: 'success',
    FAILED: 'danger',
    REJECTED: 'neutral',
  } as Record<string, BadgeTone>,
  account: {
    ACTIVE: 'success',
    SUSPENDED: 'danger',
    DEACTIVATED: 'neutral',
  } as Record<string, BadgeTone>,
  verification: {
    DRAFT: 'neutral',
    SUBMITTED: 'warning',
    UNDER_REVIEW: 'warning',
    VERIFIED: 'success',
    REJECTED: 'danger',
    SUSPENDED: 'danger',
  } as Record<string, BadgeTone>,
  dispute: {
    OPEN: 'danger',
    UNDER_REVIEW: 'warning',
    RESOLVED_CUSTOMER: 'success',
    RESOLVED_PARTNER: 'success',
    CLOSED: 'neutral',
    WITHDRAWN: 'neutral',
  } as Record<string, BadgeTone>,
  review: {
    PENDING: 'warning',
    PUBLISHED: 'success',
    HIDDEN: 'warning',
    REMOVED: 'danger',
  } as Record<string, BadgeTone>,
  invoice: {
    DRAFT: 'neutral',
    ISSUED: 'info',
    PAID: 'success',
    VOID: 'danger',
    REFUNDED: 'info',
  } as Record<string, BadgeTone>,
  role: {
    CUSTOMER: 'info',
    PARTNER: 'accent',
    ADMIN: 'danger',
  } as Record<string, BadgeTone>,
} as const;

export type ToneGroup = keyof typeof toneMaps;

export function toneFor(group: ToneGroup, status: string | null | undefined): BadgeTone {
  const map = toneMaps[group];
  return (status && map[status]) || 'neutral';
}

export const STATUS_OPTIONS = {
  booking: [
    '',
    'PENDING_APPROVAL',
    'AWAITING_PAYMENT',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'REJECTED',
    'REFUND_PENDING',
    'REFUNDED',
    'DISPUTED',
  ],
  listing: ['', 'DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED', 'SUSPENDED', 'ARCHIVED'],
  listingType: ['', 'WAREHOUSE', 'EQUIPMENT', 'SERVICE'],
  payment: ['', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED'],
  refund: ['', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED'],
  dispute: ['', 'OPEN', 'UNDER_REVIEW', 'RESOLVED_CUSTOMER', 'RESOLVED_PARTNER', 'CLOSED', 'WITHDRAWN'],
  verification: ['', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED'],
  account: ['', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'],
  role: ['', 'CUSTOMER', 'PARTNER', 'ADMIN'],
} as const;
