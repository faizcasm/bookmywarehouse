/** Search filter serialization tests. */

import {
  EMPTY_FILTERS,
  filtersFromParams,
  filtersToApiQuery,
  countActiveFilters,
} from '../searchFilters';

describe('filtersFromParams', () => {
  it('returns empty filters for empty params', () => {
    expect(filtersFromParams({})).toEqual(EMPTY_FILTERS);
  });

  it('reads set values and normalises blanks away', () => {
    const f = filtersFromParams({ q: 'cold', city: 'Mumbai', minPrice: '', verifiedOnly: 'true', page: '3' });
    expect(f.q).toBe('cold');
    expect(f.city).toBe('Mumbai');
    expect(f.minPrice).toBe('');
    expect(f.verifiedOnly).toBe(true);
    expect(f.page).toBe(3);
  });

  it('falls back to page 1 for bad pagination', () => {
    expect(filtersFromParams({ page: 'abc' }).page).toBe(1);
    expect(filtersFromParams({ page: '0' }).page).toBe(1);
  });
});

describe('filtersToApiQuery', () => {
  it('omits empty and default values so URLs stay clean', () => {
    const q = filtersToApiQuery(EMPTY_FILTERS);
    expect(q.q).toBeUndefined();
    expect(q.city).toBeUndefined();
    expect(q.verifiedOnly).toBeUndefined();
    expect(q.page).toBeUndefined();
    expect(q.sort).toBe('relevance');
  });

  it('includes set filters and verifiedOnly as "true"', () => {
    const f = { ...EMPTY_FILTERS, q: 'forklift', verifiedOnly: true, page: 2, sort: 'price_asc' };
    const q = filtersToApiQuery(f);
    expect(q.q).toBe('forklift');
    expect(q.verifiedOnly).toBe('true');
    expect(q.page).toBe(2);
    expect(q.sort).toBe('price_asc');
  });
});

describe('countActiveFilters', () => {
  it('counts only user-set filters (not sort/page)', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, q: 'x' })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, q: 'x', verifiedOnly: true })).toBe(2);
  });
});
