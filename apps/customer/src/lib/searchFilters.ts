/**
 * Search filter state ↔ URL query-param serialization (shareable search links).
 * Pure functions so they can be unit-tested and reused by the Home hero search
 * and the /search page.
 */

import type { QueryParams } from './api';

export interface SearchFilters {
  q: string;
  type: string;
  city: string;
  minPrice: string;
  maxPrice: string;
  capacityMin: string;
  amenities: string;
  verifiedOnly: boolean;
  minRating: string;
  categoryId: string;
  sort: string;
  page: number;
}

export const DEFAULT_SORT = 'relevance';

export const EMPTY_FILTERS: SearchFilters = {
  q: '',
  type: '',
  city: '',
  minPrice: '',
  maxPrice: '',
  capacityMin: '',
  amenities: '',
  verifiedOnly: false,
  minRating: '',
  categoryId: '',
  sort: DEFAULT_SORT,
  page: 1,
};

const STRING_KEYS = ['q', 'type', 'city', 'minPrice', 'maxPrice', 'capacityMin', 'amenities', 'minRating', 'categoryId'] as const;

/** Read filters out of a URLSearchParams instance (empty strings normalized away). */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
  const filters: SearchFilters = { ...EMPTY_FILTERS };
  for (const key of STRING_KEYS) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }
  filters.verifiedOnly = params.get('verifiedOnly') === 'true';
  const sort = params.get('sort');
  filters.sort = sort || DEFAULT_SORT;
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  filters.page = Number.isFinite(page) && page > 0 ? page : 1;
  return filters;
}

/** Serialize filters to URLSearchParams, omitting empty/default values. */
export function buildSearchQuery(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of STRING_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (filters.verifiedOnly) params.set('verifiedOnly', 'true');
  if (filters.sort && filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

/** Convert filters into the query object accepted by `/catalog/search`. */
export function filtersToApiQuery(filters: SearchFilters): QueryParams {
  return {
    q: filters.q || undefined,
    type: filters.type || undefined,
    city: filters.city || undefined,
    minPrice: filters.minPrice || undefined,
    maxPrice: filters.maxPrice || undefined,
    capacityMin: filters.capacityMin || undefined,
    amenities: filters.amenities || undefined,
    verifiedOnly: filters.verifiedOnly ? 'true' : undefined,
    minRating: filters.minRating || undefined,
    categoryId: filters.categoryId || undefined,
    sort: filters.sort || DEFAULT_SORT,
    page: filters.page > 1 ? filters.page : undefined,
  };
}

/** Count of user-set filters (excluding sort/pagination). */
export function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  for (const key of STRING_KEYS) {
    if (filters[key]) count += 1;
  }
  if (filters.verifiedOnly) count += 1;
  return count;
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return countActiveFilters(filters) > 0;
}
