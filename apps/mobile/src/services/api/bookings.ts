/** Customer booking endpoints (quote, create, list, detail, cancel). */

import type { BookingDTO, QuoteResponseDTO } from '@bmw/shared-types';

import { api } from './client';
import { toBooking, toBookingQuote, toQuoteInput } from './normalize';
import type { Booking, BookingQuote, Paginated } from '@/types';
import type { QueryParams } from './client';

export interface QuoteInput {
  listingId: string;
  startDate: string;
  /** Omit for open-ended (no fixed end date) bookings. */
  endDate?: string;
  spaceUnits: number;
}

export function getQuote(input: QuoteInput): Promise<BookingQuote> {
  const body = { ...input, ...toQuoteInput(input.spaceUnits) };
  return api.post<QuoteResponseDTO>('/bookings/quote', body).then((dto) => toBookingQuote(dto, input.spaceUnits));
}

export interface CreateBookingInput extends QuoteInput {
  specialInstructions?: string;
}

export function createBooking(input: CreateBookingInput): Promise<Booking> {
  const body = {
    ...input,
    ...toQuoteInput(input.spaceUnits),
    specialRequirements: input.specialInstructions,
  };
  return api.post<BookingDTO>('/bookings', body).then(toBooking);
}

export function listBookings(query?: QueryParams): Promise<Paginated<Booking>> {
  return api.getPaged<BookingDTO>('/bookings', query).then((dto) => ({
    items: dto.items.map(toBooking),
    meta: dto.meta,
  }));
}

export function getBooking(id: string): Promise<Booking> {
  return api.get<BookingDTO>(`/bookings/${encodeURIComponent(id)}`).then(toBooking);
}

/** The API's cancelBookingSchema requires a non-empty reason (min 3 chars). */
export function cancelBooking(id: string, reason = 'Cancelled by customer'): Promise<Booking> {
  return api
    .post<BookingDTO>(`/bookings/${encodeURIComponent(id)}/cancel`, { reason })
    .then(toBooking);
}

/* Booking lifecycle transitions — /bookings/:id/{accept,reject,start,complete}. */
export function acceptBooking(id: string): Promise<Booking> {
  return api.post<BookingDTO>(`/bookings/${encodeURIComponent(id)}/accept`).then(toBooking);
}

export function rejectBooking(id: string, reason: string): Promise<Booking> {
  return api
    .post<BookingDTO>(`/bookings/${encodeURIComponent(id)}/reject`, { reason })
    .then(toBooking);
}

export function startBooking(id: string): Promise<Booking> {
  return api.post<BookingDTO>(`/bookings/${encodeURIComponent(id)}/start`).then(toBooking);
}

export function completeBooking(id: string, note?: string): Promise<Booking> {
  return api
    .post<BookingDTO>(`/bookings/${encodeURIComponent(id)}/complete`, note ? { note } : {})
    .then(toBooking);
}

/** POST /bookings/:id/dispute is exposed on the account service; re-exported here for convenience. */
export { openDispute } from './account';
