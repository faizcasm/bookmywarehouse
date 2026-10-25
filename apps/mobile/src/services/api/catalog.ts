/** Public catalog (discovery) endpoints. */

import type { AvailabilityExceptionDTO, AvailabilityRuleDTO, ListingDetailDTO, ListingSummaryDTO } from '@bmw/shared-types';

import { api } from './client';
import { buildAvailabilitySlots, toListingDetail, toListingSummary } from './normalize';
import type { ListingSummary, ListingDetail, Category, AvailabilitySlot, Paginated } from '@/types';
import type { QueryParams } from './client';

export function searchListings(query: QueryParams): Promise<Paginated<ListingSummary>> {
  return api.getPaged<ListingSummaryDTO>('/catalog/search', query).then((dto) => ({
    items: dto.items.map(toListingSummary),
    meta: dto.meta,
  }));
}

export function getListing(slug: string): Promise<ListingDetail> {
  return api.get<ListingDetailDTO>(`/catalog/listings/${encodeURIComponent(slug)}`).then(toListingDetail);
}

export function getListingAvailability(
  slug: string,
  query?: QueryParams,
): Promise<AvailabilitySlot[]> {
  const days = Number(query?.days) > 0 ? Number(query?.days) : 14;
  return api
    .get<{ rules?: AvailabilityRuleDTO[]; blockedDates?: AvailabilityExceptionDTO[] }>(
      `/catalog/listings/${encodeURIComponent(slug)}/availability`,
      query,
    )
    .then((d) => buildAvailabilitySlots(d.rules ?? [], d.blockedDates ?? [], days));
}

export function getCategories(): Promise<Category[]> {
  return api.getPaged<Category>('/catalog/categories').then((d) => d.items);
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
