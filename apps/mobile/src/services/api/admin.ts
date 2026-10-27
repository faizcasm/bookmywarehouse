/**
 * Admin endpoints (dashboard, users, partners, verifications, listings,
 * bookings, payments, refunds, invoices, disputes, categories, reviews,
 * settings, audit, exports). Matches admin.routes.ts exactly.
 */

import type { BookingDTO, DisputeDTO, ReviewDTO } from '@bmw/shared-types';

import { api, apiText } from './client';
import { toBooking, toDispute, toReview } from './normalize';
import type { Booking, Dispute, Paginated, Review, User } from '@/types';
import type { QueryParams } from './client';

/* ------------------------------- dashboard ------------------------------- */

export interface AdminDashboard {
  totals: {
    customers: number;
    partners: number;
    verifiedPartners: number;
    listings: number;
    activeListings: number;
    bookings: number;
    pendingBookings: number;
    disputesOpen: number;
    pendingVerifications: number;
    pendingListings: number;
  };
  revenue: {
    currency: string;
    grossCollected: number;
    platformFees: number;
    refunds: number;
    netCollected: number;
    periodDays: number;
  };
  /** 14-day `{ date, bookings, grossAmount }` series for the dashboard charts. */
  trends: { date: string; bookings: number; grossAmount: number }[];
  recentBookings: Booking[];
  recentDisputes: Dispute[];
}

interface AdminDashboardEnvelope {
  totals?: Partial<AdminDashboard['totals']>;
  revenue?: Partial<AdminDashboard['revenue']>;
  trends?: { date: string; bookings?: number; grossAmount?: number }[];
  recentBookings?: BookingDTO[];
  recentDisputes?: DisputeDTO[];
}

export function getAdminDashboard(): Promise<AdminDashboard> {
  return api.get<AdminDashboardEnvelope>('/admin/dashboard').then((d) => ({
    totals: {
      customers: d.totals?.customers ?? 0,
      partners: d.totals?.partners ?? 0,
      verifiedPartners: d.totals?.verifiedPartners ?? 0,
      listings: d.totals?.listings ?? 0,
      activeListings: d.totals?.activeListings ?? 0,
      bookings: d.totals?.bookings ?? 0,
      pendingBookings: d.totals?.pendingBookings ?? 0,
      disputesOpen: d.totals?.disputesOpen ?? 0,
      pendingVerifications: d.totals?.pendingVerifications ?? 0,
      pendingListings: d.totals?.pendingListings ?? 0,
    },
    revenue: {
      currency: d.revenue?.currency ?? 'INR',
      grossCollected: d.revenue?.grossCollected ?? 0,
      platformFees: d.revenue?.platformFees ?? 0,
      refunds: d.revenue?.refunds ?? 0,
      netCollected: d.revenue?.netCollected ?? 0,
      periodDays: d.revenue?.periodDays ?? 30,
    },
    trends: (d.trends ?? []).map((point) => ({
      date: point.date,
      bookings: point.bookings ?? 0,
      grossAmount: point.grossAmount ?? 0,
    })),
    recentBookings: (d.recentBookings ?? []).map(toBooking),
    recentDisputes: (d.recentDisputes ?? []).map(toDispute),
  }));
}

/* --------------------------------- users --------------------------------- */

export type UserModerationAction = 'SUSPEND' | 'REACTIVATE' | 'DEACTIVATE';

export function listAdminUsers(query?: QueryParams): Promise<Paginated<User>> {
  return api.getPaged<User>('/admin/users', query);
}

/** PATCH /admin/users/:id — suspend / reactivate / deactivate. */
export function moderateUser(id: string, action: UserModerationAction, reason?: string): Promise<void> {
  return api.patch(`/admin/users/${encodeURIComponent(id)}`, { action, reason: reason ?? null });
}

/** POST /admin/users — admin creates a customer/partner/admin account. */
export function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  role: 'CUSTOMER' | 'PARTNER' | 'ADMIN';
  phone?: string;
}): Promise<User> {
  return api.post<User>('/admin/users', input);
}

/* ------------------------------- partners/KYC ---------------------------- */

export interface AdminPartnerRow {
  partnerId: string;
  userId: string;
  businessName: string;
  businessType?: string | null;
  verificationStatus: string;
  city?: string | null;
  listingCount?: number;
  totalBookings?: number;
  user?: { id: string; name: string; email: string; status: string; avatarUrl?: string | null } | null;
  createdAt?: string;
}

export type PartnerDecision = 'APPROVE' | 'REJECT' | 'SUSPEND';

export function listVerifications(query?: QueryParams): Promise<Paginated<AdminPartnerRow>> {
  return api.getPaged<AdminPartnerRow>('/admin/verification-queue', query);
}

export function listAdminPartners(query?: QueryParams): Promise<Paginated<AdminPartnerRow>> {
  return api.getPaged<AdminPartnerRow>('/admin/partners', query);
}

export function getAdminPartner(id: string): Promise<Record<string, unknown>> {
  return api.get(`/admin/partners/${encodeURIComponent(id)}`);
}

/** POST /admin/partners/:id/decision — `id` is the PartnerProfile id. */
export function decidePartner(
  partnerId: string,
  decision: PartnerDecision,
  reason?: string,
): Promise<void> {
  return api.post(`/admin/partners/${encodeURIComponent(partnerId)}/decision`, {
    decision,
    reason: reason ?? null,
  });
}

/* ------------------------------- listings -------------------------------- */

export type ListingModerationDecision = 'APPROVE' | 'REJECT' | 'SUSPEND' | 'UNSUSPEND';

export interface AdminListingRow {
  id: string;
  title?: string;
  type?: string;
  status?: string;
  city?: string;
  price?: { amount?: number; currency?: string } | null;
  createdAt?: string;
}

export function listAdminListings(query?: QueryParams): Promise<Paginated<AdminListingRow>> {
  return api.getPaged<AdminListingRow>('/admin/listings', query);
}

/** PATCH /admin/listings/:id */
export function moderateListing(
  id: string,
  decision: ListingModerationDecision,
  reason?: string,
): Promise<void> {
  return api.patch(`/admin/listings/${encodeURIComponent(id)}`, { decision, reason: reason ?? null });
}

/* -------------------------------- bookings ------------------------------- */

/** Admin sees every booking via the shared /bookings list with scope=admin. */
export function listAdminBookings(query?: QueryParams): Promise<Paginated<Booking>> {
  return api.getPaged<BookingDTO>('/bookings', { ...query, scope: 'admin' }).then((dto) => ({
    items: dto.items.map(toBooking),
    meta: dto.meta,
  }));
}

/* --------------------------- payments and refunds ------------------------ */

export interface AdminPaymentRow {
  id: string;
  reference?: string;
  status?: string;
  amount?: number;
  currency?: string;
  provider?: string;
  createdAt?: string;
}

export function listAdminPayments(query?: QueryParams): Promise<Paginated<AdminPaymentRow>> {
  return api.getPaged<AdminPaymentRow>('/admin/payments', query);
}

export interface AdminRefundRow {
  id: string;
  status?: string;
  amountMinor?: number;
  amount?: number;
  currency?: string;
  createdAt?: string;
}

export function listAdminRefunds(query?: QueryParams): Promise<Paginated<AdminRefundRow>> {
  return api.getPaged<AdminRefundRow>('/admin/refunds', query);
}

/**
 * POST /admin/refunds/:id/process — **the API accepts no body**: it processes
 * the full stored refund amount, so there is no amount/reason parameter to pass.
 * The confirmation UI must therefore state the stored amount rather than collect
 * one.
 */
export function processRefund(id: string): Promise<void> {
  return api.post(`/admin/refunds/${encodeURIComponent(id)}/process`);
}

export interface AdminInvoiceRow {
  id: string;
  invoiceNumber?: string;
  status?: string;
  total?: number;
  currency?: string;
  createdAt?: string;
}

export function listAdminInvoices(query?: QueryParams): Promise<Paginated<AdminInvoiceRow>> {
  return api.getPaged<AdminInvoiceRow>('/admin/invoices', query);
}

/* -------------------------------- disputes ------------------------------- */

export interface AdminDisputeRow {
  id: string;
  bookingId?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
}

export type DisputeResolution = 'RESOLVED_CUSTOMER' | 'RESOLVED_PARTNER' | 'CLOSED';

export function listAdminDisputes(query?: QueryParams): Promise<Paginated<AdminDisputeRow>> {
  return api.getPaged<AdminDisputeRow>('/admin/disputes', query);
}

export function resolveDispute(
  id: string,
  resolution: DisputeResolution,
  resolutionNote: string,
  refundAmount?: number,
): Promise<void> {
  return api.post(`/admin/disputes/${encodeURIComponent(id)}/resolve`, {
    resolution,
    resolutionNote,
    refundAmount: refundAmount ?? null,
  });
}

/* ------------------------------- categories ------------------------------ */

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  type?: string;
  isActive?: boolean;
  parentId?: string | null;
}

export function listAdminCategories(): Promise<AdminCategory[]> {
  return api
    .get<{ items: AdminCategory[] }>('/admin/categories', { includeInactive: 'true' })
    .then((d) => d.items);
}

export function createCategory(input: {
  name: string;
  slug: string;
  type: string;
  parentId?: string;
}): Promise<AdminCategory> {
  return api.post<AdminCategory>('/admin/categories', input);
}

export function updateCategory(id: string, input: Partial<{ name: string; slug: string; isActive: boolean; parentId: string | null }>): Promise<void> {
  return api.patch(`/admin/categories/${encodeURIComponent(id)}`, input);
}

/* --------------------------------- reviews ------------------------------- */

export type ReviewModerationStatus = 'PUBLISHED' | 'HIDDEN' | 'REMOVED';

export function listAdminReviews(query?: QueryParams): Promise<Paginated<Review>> {
  return api.getPaged<ReviewDTO>('/admin/reviews', query).then((dto) => ({
    items: dto.items.map(toReview),
    meta: dto.meta,
  }));
}

/** POST /admin/reviews/:id/moderate */
export function moderateReview(id: string, status: ReviewModerationStatus, note?: string): Promise<void> {
  return api.post(`/admin/reviews/${encodeURIComponent(id)}/moderate`, { status, note: note ?? null });
}

/* ----------------------------- settings / audit -------------------------- */

export interface PlatformSettings {
  currency?: string;
  platformFeePercent?: number;
  customerFeePercent?: number;
  taxPercent?: number;
  minPayoutAmount?: number;
  supportEmail?: string;
  allowSelfServiceListings?: boolean;
  requirePartnerVerification?: boolean;
  maintenanceMode?: boolean;
  announcement?: string | null;
}

export function getAdminSettings(): Promise<PlatformSettings> {
  return api.get<PlatformSettings>('/admin/settings');
}

export function updateAdminSettings(input: PlatformSettings): Promise<void> {
  return api.patch('/admin/settings', input);
}

export interface AuditLogRow {
  id: string;
  /** Populated actor — `{id, name, role}`; `id: 'system'` for system actions. */
  actor?: { id?: string; name?: string; role?: string } | string | null;
  action?: string;
  entityType?: string;
  entityId?: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt?: string;
}

export function listAuditLogs(query?: QueryParams): Promise<Paginated<AuditLogRow>> {
  return api.getPaged<AuditLogRow>('/admin/audit-logs', query);
}

/* --------------------------------- exports ------------------------------- */

/** GET /admin/exports/{bookings|payouts}.csv — returns the raw CSV text. */
export function downloadExport(kind: 'bookings' | 'payouts'): Promise<string> {
  return apiText(`/admin/exports/${kind}.csv`);
}
