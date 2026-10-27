/** Public catalog (discovery) endpoints. */

import type { AvailabilityExceptionDTO, AvailabilityRuleDTO, ListingDetailDTO, ListingSummaryDTO, PlatformSettingsDTO, ReviewDTO } from '@bmw/shared-types';

import { api } from './client';
import { buildAvailabilitySlots, toListingDetail, toListingSummary, toReview } from './normalize';
import type { ListingSummary, ListingDetail, Category, AvailabilitySlot, Paginated, Review } from '@/types';
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

/**
 * GET /catalog/listings/:id/availability.
 *
 * ⚠ The backend queries `AvailabilityRule.find({ listing: <param> })` with no
 * slug resolution, so passing a slug makes Mongoose throw a CastError (500).
 * Callers MUST pass the listing **id**, never the slug.
 *
 * Returns the raw rules + exceptions; `buildAvailabilitySlots` turns them into
 * the per-day strip the UI renders.
 */
export function getListingAvailability(
  listingId: string,
  query?: QueryParams,
): Promise<AvailabilitySlot[]> {
  const days = Number(query?.days) > 0 ? Number(query?.days) : 14;
  return api
    .get<{ rules?: AvailabilityRuleDTO[]; blockedDates?: AvailabilityExceptionDTO[] }>(
      `/catalog/listings/${encodeURIComponent(listingId)}/availability`,
      query,
    )
    .then((d) => buildAvailabilitySlots(d.rules ?? [], d.blockedDates ?? [], days));
}

/** Human-readable availability rules (no per-day computation) for the detail page. */
export function getListingAvailabilityRules(
  listingId: string,
): Promise<{ rules: AvailabilityRuleDTO[]; blockedDates: AvailabilityExceptionDTO[] }> {
  return api.get(`/catalog/listings/${encodeURIComponent(listingId)}/availability`);
}

/** GET /catalog/listings/:id/reviews — public review feed (id or slug accepted). */
export function getListingReviews(
  listingRef: string,
  query?: QueryParams,
): Promise<Paginated<Review> & { average: number }> {
  return api
    .getWithMeta<{ items: ReviewDTO[]; average?: number }>(
      `/catalog/listings/${encodeURIComponent(listingRef)}/reviews`,
      { page: 1, limit: 10, ...query },
    )
    .then((r) => ({
      items: (r.data?.items ?? []).map(toReview),
      average: r.data?.average ?? 0,
      meta: r.meta,
    }));
}

/** GET /catalog/listings/:slug/similar — ≤4 related listings. */
export function getSimilarListings(slug: string): Promise<ListingSummary[]> {
  return api
    .get<{ items: ListingSummaryDTO[] }>(`/catalog/listings/${encodeURIComponent(slug)}/similar`)
    .then((d) => (d.items ?? []).map(toListingSummary));
}

/** GET /catalog/settings — public platform settings (announcement banner, fees). */
export function getPlatformSettings(): Promise<PlatformSettingsDTO> {
  return api.get<PlatformSettingsDTO>('/catalog/settings');
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
