import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  buildSearchQuery,
  countActiveFilters,
  filtersFromParams,
  filtersToApiQuery,
  type SearchFilters,
} from '../lib/searchFilters';

describe('search filters serialization', () => {
  it('reads filters from URL query params', () => {
    const params = new URLSearchParams(
      'q=forklift&city=Pune&type=EQUIPMENT&minPrice=1000&maxPrice=9000&capacityMin=50&amenities=CCTV&verifiedOnly=true&minRating=4&sort=price_asc&page=3',
    );
    const filters = filtersFromParams(params);
    expect(filters).toMatchObject({
      q: 'forklift',
      city: 'Pune',
      type: 'EQUIPMENT',
      minPrice: '1000',
      maxPrice: '9000',
      capacityMin: '50',
      amenities: 'CCTV',
      verifiedOnly: true,
      minRating: '4',
      sort: 'price_asc',
      page: 3,
    });
  });

  it('falls back to defaults for missing or invalid params', () => {
    const filters = filtersFromParams(new URLSearchParams('page=banana&verifiedOnly=false'));
    expect(filters).toEqual({ ...EMPTY_FILTERS, page: 1, verifiedOnly: false });
  });

  it('serializes set filters and omits empty/default values', () => {
    const filters: SearchFilters = {
      ...EMPTY_FILTERS,
      q: 'cold storage',
      city: 'Nashik',
      verifiedOnly: true,
      sort: 'rating_desc',
      page: 2,
    };
    const params = buildSearchQuery(filters);
    expect(params.get('q')).toBe('cold storage');
    expect(params.get('city')).toBe('Nashik');
    expect(params.get('verifiedOnly')).toBe('true');
    expect(params.get('sort')).toBe('rating_desc');
    expect(params.get('page')).toBe('2');
    expect(params.get('type')).toBeNull();
    expect(params.get('minPrice')).toBeNull();
    expect(params.get('minRating')).toBeNull();
  });

  it('omits page=1 and default sort from the URL', () => {
    const params = buildSearchQuery({ ...EMPTY_FILTERS, q: 'warehouse' });
    expect(params.toString()).toBe('q=warehouse');
  });

  it('round-trips filters through URL params', () => {
    const original: SearchFilters = {
      q: 'pallet truck',
      type: 'EQUIPMENT',
      city: 'Pune',
      minPrice: '500',
      maxPrice: '50000',
      capacityMin: '10',
      amenities: 'delivery',
      verifiedOnly: true,
      minRating: '3',
      categoryId: 'abc123',
      sort: 'newest',
      page: 2,
    };
    const roundTripped = filtersFromParams(buildSearchQuery(original));
    expect(roundTripped).toEqual(original);
  });

  it('converts to an API query dropping empty values', () => {
    const query = filtersToApiQuery({ ...EMPTY_FILTERS, city: 'Pune', verifiedOnly: true, sort: 'newest' });
    expect(query).toEqual({
      city: 'Pune',
      verifiedOnly: 'true',
      sort: 'newest',
    });
  });

  it('counts active filters excluding sort and pagination', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, q: 'x', sort: 'newest', page: 4 })).toBe(1);
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, q: 'x', city: 'Pune', type: 'WAREHOUSE', verifiedOnly: true }),
    ).toBe(4);
  });
});
