/** Partner endpoints (dashboard, profile, listings, availability, bookings, earnings, verification). */

import { api } from './client';
import type { PartnerDashboard, Payout, VerificationState, ListingDetail, Booking, Paginated, AvailabilitySlot } from '@/types';
import type { QueryParams } from './client';

export function getPartnerDashboard(): Promise<PartnerDashboard> {
  return api.get<PartnerDashboard>('/partner/dashboard');
}

export function getPartnerProfile(): Promise<{ profile: Record<string, unknown> }> {
  return api.get('/partner/profile');
}

export function updatePartnerProfile(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  return api.patch('/partner/profile', input);
}

export function listPartnerListings(query?: QueryParams): Promise<Paginated<ListingDetail>> {
  return api.get<Paginated<ListingDetail>>('/partner/listings', query);
}

export interface CreateListingInput {
  title: string;
  type: 'WAREHOUSE' | 'EQUIPMENT' | 'SERVICE';
  categoryId: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  capacityValue: number;
  capacityUnit: string;
  pricingPeriod: string;
  basePriceMinor: number;
  amenities?: string[];
  operatingHours?: Record<string, { open: string; close: string }>;
  rules?: string[];
  coverImageId?: string;
  galleryImageIds?: string[];
}

export function createListing(input: CreateListingInput): Promise<ListingDetail> {
  return api.post<ListingDetail>('/partner/listings', input);
}

export function updateListing(id: string, input: Partial<CreateListingInput>): Promise<ListingDetail> {
  return api.patch<ListingDetail>(`/partner/listings/${encodeURIComponent(id)}`, input);
}

export function deleteListing(id: string): Promise<void> {
  return api.delete(`/partner/listings/${encodeURIComponent(id)}`);
}

export function publishListing(id: string): Promise<ListingDetail> {
  return api.post<ListingDetail>(`/partner/listings/${encodeURIComponent(id)}/publish`);
}

export function unpublishListing(id: string): Promise<ListingDetail> {
  return api.post<ListingDetail>(`/partner/listings/${encodeURIComponent(id)}/unpublish`);
}

export function archiveListing(id: string): Promise<ListingDetail> {
  return api.post<ListingDetail>(`/partner/listings/${encodeURIComponent(id)}/archive`);
}

export function listAvailability(listingId: string): Promise<AvailabilitySlot[]> {
  return api
    .get<{ items: AvailabilitySlot[] }>(`/partner/listings/${encodeURIComponent(listingId)}/availability`)
    .then((d) => d.items);
}

export function setAvailability(listingId: string, input: { rules: AvailabilitySlot[] }): Promise<void> {
  return api.post(`/partner/listings/${encodeURIComponent(listingId)}/availability`, input);
}

export function deleteAvailability(listingId: string, ruleId: string): Promise<void> {
  return api.delete(`/partner/listings/${encodeURIComponent(listingId)}/availability/${encodeURIComponent(ruleId)}`);
}

export function listPartnerBookings(query?: QueryParams): Promise<Paginated<Booking>> {
  return api.get<Paginated<Booking>>('/partner/bookings', query);
}

export function getPartnerBooking(id: string): Promise<Booking> {
  return api.get<Booking>(`/partner/bookings/${encodeURIComponent(id)}`);
}

export function confirmBooking(id: string): Promise<Booking> {
  return api.post<Booking>(`/partner/bookings/${encodeURIComponent(id)}/confirm`);
}

export function startBooking(id: string): Promise<Booking> {
  return api.post<Booking>(`/partner/bookings/${encodeURIComponent(id)}/start`);
}

export function completeBooking(id: string): Promise<Booking> {
  return api.post<Booking>(`/partner/bookings/${encodeURIComponent(id)}/complete`);
}

export function cancelPartnerBooking(id: string, reason?: string): Promise<Booking> {
  return api.post<Booking>(`/partner/bookings/${encodeURIComponent(id)}/cancel`, { reason });
}

export function getEarnings(): Promise<{ totalEarningsMinor: number; currency: string; payouts: Payout[] }> {
  return api.get('/partner/earnings');
}

export function getPayouts(): Promise<Payout[]> {
  return api.get<{ items: Payout[] }>('/partner/payouts').then((d) => d.items);
}

export function getVerificationState(): Promise<VerificationState> {
  return api.get<VerificationState>('/partner/verification');
}

export function submitVerification(input: { documents: { url: string; type: string }[] }): Promise<VerificationState> {
  return api.post<VerificationState>('/partner/verification/submit', input);
}