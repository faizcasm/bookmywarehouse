/** Small, versioned persistence helpers for recent and saved catalog searches. */

import { EMPTY_FILTERS, type SearchFilters } from './searchFilters';

const STRING_FIELDS = [
  'q',
  'type',
  'city',
  'minPrice',
  'maxPrice',
  'capacityMin',
  'amenities',
  'minRating',
  'categoryId',
  'sort',
] as const;

export function isStoredSearch(value: unknown): value is SearchFilters {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    STRING_FIELDS.every((field) => typeof record[field] === 'string') &&
    typeof record.verifiedOnly === 'boolean' &&
    typeof record.page === 'number' &&
    Number.isFinite(record.page)
  );
}

/** A corrupt or stale local-storage value should never break search. */
export function parseStoredSearches(raw: string | null): SearchFilters[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isStoredSearch)
      .map((item) => ({ ...EMPTY_FILTERS, ...item, page: 1 }))
      .slice(0, 8);
  } catch {
    return [];
  }
}

/** Signature excludes pagination so one search is not saved once per page. */
export function searchSignature(filters: SearchFilters): string {
  return JSON.stringify({
    q: filters.q.trim(),
    type: filters.type,
    city: filters.city,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    capacityMin: filters.capacityMin,
    amenities: filters.amenities,
    verifiedOnly: filters.verifiedOnly,
    minRating: filters.minRating,
    categoryId: filters.categoryId,
    sort: filters.sort,
  });
}

/** Move the latest search to the front, remove duplicates and cap storage. */
export function prependSearch(
  current: SearchFilters[],
  candidate: SearchFilters,
  limit = 8,
): SearchFilters[] {
  const normalized = { ...EMPTY_FILTERS, ...candidate, page: 1 };
  const signature = searchSignature(normalized);
  return [
    normalized,
    ...current.filter((item) => searchSignature(item) !== signature),
  ].slice(0, Math.max(1, limit));
}
