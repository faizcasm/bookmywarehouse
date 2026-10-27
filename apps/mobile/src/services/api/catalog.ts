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

/** `slug` — the public detail route is keyed by slug, not id. */
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

/**
 * The API has no dedicated cities feed, so search's city chips use this curated
 * list of major Indian logistics hubs. Kept here (not inline in the screen) so
 * it stays a single, easy-to-swap source.
 */
export const POPULAR_CITIES: string[] = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Ahmedabad',
  'Kolkata',
  'Jaipur',
  'Surat',
  'Lucknow',
  'Indore',
];
