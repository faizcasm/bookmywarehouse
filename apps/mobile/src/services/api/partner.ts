/**
 * Partner endpoints.
 *
 * Booking lifecycle and the booking list/detail live under /bookings (auto-
 * scoped to the acting partner server-side), so those are re-exported from the
 * bookings service. Everything under /partner here matches partner.routes.ts.
 */

import type {
  AvailabilityExceptionDTO,
  AvailabilityRuleDTO,
  ListingDetailDTO,
  ListingSummaryDTO,
  PartnerDashboardDTO,
} from '@bmw/shared-types';

import { api } from './client';
import { toListingDetail, toListingSummary, toPartnerDashboard } from './normalize';
import type {
  AvailabilitySlot,
  Earning,
  ListingDetail,
  ListingSummary,
  Paginated,
  PartnerDashboard,
  PartnerProfile,
  VerificationState,
  Currency,
} from '@/types';
import type { QueryParams } from './client';

export {
  getBooking as getPartnerBooking,
  acceptBooking as confirmBooking,
  startBooking,
  completeBooking,
  cancelBooking as cancelPartnerBooking,
  rejectBooking as rejectPartnerBooking,
  listBookings as listPartnerBookings,
} from './bookings';

/* ------------------------------ profile / KYC ---------------------------- */

/** GET /partner/dashboard — KPIs normalized to the mobile view-model. */
export function getPartnerDashboard(): Promise<PartnerDashboard> {
  return api.get<PartnerDashboardDTO>('/partner/dashboard').then(toPartnerDashboard);
}

export function getPartnerProfile(): Promise<PartnerProfile> {
  return api.get<PartnerProfile>('/partner/profile');
}

export interface OnboardingInput {
  businessName: string;
  businessType?: string;
  description?: string | null;
  address: {
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  website?: string | null;
  logoUrl?: string | null;
  supportedTypes: ('WAREHOUSE' | 'EQUIPMENT' | 'SERVICE')[];
}

/** POST /partner/onboarding — create/update the business profile. */
export function onboardPartner(input: OnboardingInput): Promise<PartnerProfile> {
  return api.post<PartnerProfile>('/partner/onboarding', input);
}

export interface VerificationInput {
  legalBusinessName: string;
  businessType: string;
  gstNumber?: string | null;
  panNumber?: string | null;
  registrationNumber?: string | null;
  address: OnboardingInput['address'];
  documents: { label: string; url: string }[];
}

/** POST /partner/verification — submit KYC for review. */
export function submitVerification(input: VerificationInput): Promise<PartnerProfile> {
  return api.post<PartnerProfile>('/partner/verification', input);
}

/** The API has no standalone GET /verification — read it from the profile. */
export function getVerificationState(): Promise<VerificationState> {
  return getPartnerProfile().then((p) => p.verification ?? { status: p.verificationStatus ?? 'DRAFT' });
}

export interface PayoutDetailsInput {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  upiId?: string | null;
}

/**
 * PATCH /partner/payout-details — bank/UPI settlement info. The API stores the
 * account number **masked** and only ever returns the last 4 digits.
 */
export function savePayoutDetails(input: PayoutDetailsInput): Promise<{ message?: string }> {
  return api.patch<{ message?: string }>('/partner/payout-details', input);
}

/* -------------------------------- listings ------------------------------- */

/**
 * GET /partner/listings returns **summaries** (no description/details), so the
 * list is typed as `ListingSummary` — detail fields are only on
 * `getPartnerListing`.
 */
export function listPartnerListings(query?: QueryParams): Promise<Paginated<ListingSummary>> {
  return api.getPaged<ListingSummaryDTO>('/partner/listings', query).then((dto) => ({
    items: dto.items.map(toListingSummary),
    meta: dto.meta,
  }));
}

export function getPartnerListing(id: string): Promise<ListingDetail> {
  return api.get<ListingDetailDTO>(`/partner/listings/${encodeURIComponent(id)}`).then(toListingDetail);
}

/**
 * Mutations under /partner/listings return `{ id, slug?, status }` — a stub
 * used for cache invalidation, **not** a full ListingDetailDTO.
 */
export interface ListingMutationResult {
  id: string;
  slug?: string;
  status?: string;
}

/** `body` should already be the nested create-listing payload — see toCreateListingPayload. */
export function createListing(body: unknown): Promise<ListingMutationResult> {
  return api.post<ListingMutationResult>('/partner/listings', body);
}

export function updateListing(id: string, body: unknown): Promise<ListingMutationResult> {
  return api.patch<ListingMutationResult>(`/partner/listings/${encodeURIComponent(id)}`, body);
}

/** DELETE → `{ deleted: true }`. */
export function deleteListing(id: string): Promise<{ deleted?: boolean }> {
  return api.delete<{ deleted?: boolean }>(`/partner/listings/${encodeURIComponent(id)}`);
}

export function publishListing(id: string): Promise<ListingMutationResult> {
  return api.post<ListingMutationResult>(`/partner/listings/${encodeURIComponent(id)}/publish`);
}

export function unpublishListing(id: string): Promise<ListingMutationResult> {
  return api.post<ListingMutationResult>(`/partner/listings/${encodeURIComponent(id)}/unpublish`);
}

export function archiveListing(id: string): Promise<ListingMutationResult> {
  return api.post<ListingMutationResult>(`/partner/listings/${encodeURIComponent(id)}/archive`);
}

/* ------------------------------ availability ----------------------------- */

export interface AvailabilityRules {
  rules: AvailabilityRuleDTO[];
  blockedDates: AvailabilityExceptionDTO[];
}

export function getListingAvailability(listingId: string): Promise<AvailabilityRules> {
  return api.get<AvailabilityRules>(
    `/partner/listings/${encodeURIComponent(listingId)}/availability`,
  );
}

export interface AvailabilityRuleInput {
  listingId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate?: string | null;
  endDate?: string | null;
}

export function addAvailabilityRule(input: AvailabilityRuleInput): Promise<{ id?: string }> {
  return api.post('/partner/availability-rules', input);
}

export function removeAvailabilityRule(ruleId: string): Promise<void> {
  return api.delete(`/partner/availability-rules/${encodeURIComponent(ruleId)}`);
}

export interface AvailabilityExceptionInput {
  listingId: string;
  date: string;
  reason?: string | null;
  isAvailable?: boolean;
}

/** `isAvailable: false` blocks the date; `true` opens an otherwise closed one. */
export function addAvailabilityException(input: AvailabilityExceptionInput): Promise<{ id?: string }> {
  return api.post('/partner/availability-exceptions', input);
}

export function removeAvailabilityException(exceptionId: string): Promise<void> {
  return api.delete(`/partner/availability-exceptions/${encodeURIComponent(exceptionId)}`);
}

export type { AvailabilitySlot };

/* -------------------------------- earnings ------------------------------- */

export interface EarningsResult {
  items: Earning[];
  total: number;
  summary: { gross: number; fees: number; net: number; currency: Currency };
}

interface EarningsEnvelope {
  items?: {
    id: string;
    bookingReference?: string;
    listingTitle?: string;
    grossAmount?: number;
    platformFee?: number;
    netAmount?: number;
    currency?: string;
    paidAt?: string | null;
  }[];
  total?: number;
  summary?: { gross?: number; fees?: number; net?: number; currency?: string };
}

export function getEarnings(query?: QueryParams): Promise<EarningsResult> {
  return api
    .getWithMeta<EarningsEnvelope>('/partner/earnings', { page: 1, limit: 50, ...query })
    .then((r) => {
      const d = r.data ?? {};
      const currency = (d.summary?.currency ?? 'INR') as Currency;
      return {
        items: (d.items ?? []).map((e) => ({
          id: e.id,
          bookingReference: e.bookingReference,
          listingTitle: e.listingTitle,
          grossAmount: e.grossAmount ?? 0,
          platformFee: e.platformFee ?? 0,
          netAmount: e.netAmount ?? 0,
          currency: (e.currency ?? currency) as Currency,
          paidAt: e.paidAt ?? null,
        })),
        total: d.total ?? 0,
        summary: {
          gross: d.summary?.gross ?? 0,
          fees: d.summary?.fees ?? 0,
          net: d.summary?.net ?? 0,
          currency,
        },
      };
    });
}

export type { PartnerDashboard };
export { toPartnerDashboard };
