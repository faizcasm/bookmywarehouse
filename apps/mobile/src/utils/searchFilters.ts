/**
 * Search filter state ↔ query-param serialization (shareable search links).
 * Pure functions so they can be unit-tested and reused by the Home hero search
 * and the Search screen. Ported from apps/customer/src/lib/searchFilters.ts;
 * the only change is the query type (a plain record instead of URLSearchParams,
 * since the API client builds query strings itself).
 */

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

const STRING_KEYS = [
  'q',
  'type',
  'city',
  'minPrice',
  'maxPrice',
  'capacityMin',
  'amenities',
  'minRating',
  'categoryId',
] as const;

/** Read filters out of a query-string record (empty strings normalized away). */
export function filtersFromParams(params: Record<string, string | undefined>): SearchFilters {
  const filters: SearchFilters = { ...EMPTY_FILTERS };
  for (const key of STRING_KEYS) {
    const value = params[key];
    if (value) filters[key] = value;
  }
  filters.verifiedOnly = params.verifiedOnly === 'true';
  filters.sort = params.sort || DEFAULT_SORT;
  const page = Number.parseInt(params.page ?? '1', 10);
  filters.page = Number.isFinite(page) && page > 0 ? page : 1;
  return filters;
}

/** Convert filters into the query object accepted by `/catalog/search`. */
export function filtersToApiQuery(filters: SearchFilters): Record<string, string | number | undefined> {
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
