/** Public catalog (discovery) endpoints. */

import { api } from './client';
import type { ListingSummary, ListingDetail, Category, AvailabilitySlot, Paginated } from '@/types';
import type { QueryParams } from './client';

export function searchListings(query: QueryParams): Promise<Paginated<ListingSummary>> {
  return api.get<Paginated<ListingSummary>>('/catalog/search', query);
}

export function getListing(slug: string): Promise<ListingDetail> {
  return api.get<ListingDetail>(`/catalog/listings/${encodeURIComponent(slug)}`);
}

export function getListingAvailability(
  slug: string,
  query?: QueryParams,
): Promise<AvailabilitySlot[]> {
  return api
    .get<{ items: AvailabilitySlot[] }>(`/catalog/listings/${encodeURIComponent(slug)}/availability`, query)
    .then((d) => d.items);
}

export function getCategories(): Promise<Category[]> {
  return api.get<{ items: Category[] }>('/catalog/categories').then((d) => d.items);
}

export function getCities(): Promise<string[]> {
  return api.get<{ items: string[] }>('/catalog/cities').then((d) => d.items);
}

export interface InquiryInput {
  listingId: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  startDate?: string;
  endDate?: string;
}

export function createInquiry(input: InquiryInput): Promise<{ id: string }> {
  return api.post<{ id: string }>('/inquiries', input);
}
