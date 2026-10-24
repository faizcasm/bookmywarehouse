/** Customer booking endpoints (quote, create, list, detail, cancel). */

import { api } from './client';
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
  return api.post<BookingQuote>('/bookings/quote', input);
}

export interface CreateBookingInput extends QuoteInput {
  specialInstructions?: string;
}

export function createBooking(input: CreateBookingInput): Promise<Booking> {
  return api.post<Booking>('/bookings', input);
}

export function listBookings(query?: QueryParams): Promise<Paginated<Booking>> {
  return api.get<Paginated<Booking>>('/bookings', query);
}

export function getBooking(id: string): Promise<Booking> {
  return api.get<Booking>(`/bookings/${encodeURIComponent(id)}`);
}

export function cancelBooking(id: string, reason?: string): Promise<Booking> {
  return api.post<Booking>(`/bookings/${encodeURIComponent(id)}/cancel`, { reason });
}
