import { Booking, PartnerProfile } from '../models/index.js';
import { partnerPayoutMinor } from './pricing.service.js';

/** UTF-8 BOM prefix so Excel opens the export with the right encoding. */
const CSV_BOM = '\uFEFF';
const CSV_EOL = '\r\n';
/** Exports are capped so a single request can never balloon into a full table scan dump. */
const EXPORT_ROW_LIMIT = 5000;
/** Bookings whose partner has (or will have) money owed to them — payouts are derived from these. */
const PAYOUT_BOOKING_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as const;

/** RFC 4180 field escaping: quote fields containing comma/quote/newline; double embedded quotes. */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Builds a CSV document (BOM + CRLF line endings) from a header row and data rows. */
export function toCsv(headers: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  const lines = [headers, ...rows].map((row) => row.map(csvField).join(','));
  return `${CSV_BOM}${lines.join(CSV_EOL)}${CSV_EOL}`;
}

/** Minor units → major units with two decimals (125000 → "1250.00"). */
export function minorToMajor(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** Dated attachment filename, e.g. bmw-bookings-2026-10-21.csv (UTC date). */
export function exportFilename(kind: 'bookings' | 'payouts', at: Date = new Date()): string {
  return `bmw-${kind}-${at.toISOString().slice(0, 10)}.csv`;
}

function dateOnly(value: Date | string | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function iso(value: Date | string | null | undefined): string {
  return value ? new Date(value).toISOString() : '';
}

export interface CsvExportResult {
  csv: string;
  rowCount: number;
}

interface BookingExportDoc {
  reference: string;
  customer: { email?: string } | null;
  partner: { email?: string } | null;
  listingSnapshot: { title: string };
  status: string;
  pricing: { currency: string; subtotalMinor: number; platformFeeMinor: number; totalMinor: number };
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
}

const BOOKINGS_HEADERS = [
  'reference',
  'customer_email',
  'partner_business',
  'listing_title',
  'status',
  'currency',
  'total_amount',
  'start_date',
  'end_date',
  'created_at',
] as const;

const PAYOUTS_HEADERS = [
  'reference',
  'partner_business',
  'partner_email',
  'amount',
  'currency',
  'status',
  'created_at',
] as const;

/** user id → business name for every partner referenced by the export. */
async function partnerBusinessNames(partnerIds: unknown[]): Promise<Map<string, string>> {
  const profiles = await PartnerProfile.find({ user: { $in: partnerIds } })
    .select('user businessName')
    .lean();
  return new Map(profiles.map((p) => [String(p.user), p.businessName]));
}

/** Latest bookings (≤5000), newest first — one query + one profile lookup. */
export async function buildBookingsCsv(): Promise<CsvExportResult> {
  const docs = await Booking.find({})
    .sort({ createdAt: -1 })
    .limit(EXPORT_ROW_LIMIT)
    .populate('customer', 'email')
    .populate('partner', 'email')
    .lean();

  const bookings = docs as unknown as BookingExportDoc[];
  const businessByUser = await partnerBusinessNames(bookings.map((b) => b.partner));

  const rows = bookings.map((b) => {
    const partnerId = b.partner ? String((b.partner as { _id?: unknown })._id ?? b.partner) : '';
    return [
      b.reference,
      b.customer?.email ?? '',
      businessByUser.get(partnerId) ?? '',
      b.listingSnapshot?.title ?? '',
      b.status,
      b.pricing?.currency ?? '',
      minorToMajor(b.pricing?.totalMinor ?? 0),
      dateOnly(b.startDate),
      dateOnly(b.endDate),
      iso(b.createdAt),
    ] as const;
  });

  return { csv: toCsv(BOOKINGS_HEADERS, rows), rowCount: rows.length };
}

/**
 * Payouts owed to partners, derived from paid bookings (CONFIRMED/IN_PROGRESS/COMPLETED).
 * There is no standalone Payout collection in this schema — the partner payout is
 * `partnerPayoutMinor(pricing)` (subtotal minus platform fee), same as the pricing service.
 */
export async function buildPayoutsCsv(): Promise<CsvExportResult> {
  const docs = await Booking.find({ status: { $in: [...PAYOUT_BOOKING_STATUSES] } })
    .sort({ createdAt: -1 })
    .limit(EXPORT_ROW_LIMIT)
    .populate('partner', 'email')
    .lean();

  const bookings = docs as unknown as BookingExportDoc[];
  const businessByUser = await partnerBusinessNames(bookings.map((b) => b.partner));

  const rows = bookings.map((b) => {
    const partnerId = b.partner ? String((b.partner as { _id?: unknown })._id ?? b.partner) : '';
    return [
      b.reference,
      businessByUser.get(partnerId) ?? '',
      b.partner?.email ?? '',
      minorToMajor(partnerPayoutMinor(b.pricing)),
      b.pricing?.currency ?? '',
      b.status,
      iso(b.createdAt),
    ] as const;
  });

  return { csv: toCsv(PAYOUTS_HEADERS, rows), rowCount: rows.length };
}
