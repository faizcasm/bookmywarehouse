import { EMPTY_FILTERS, type SearchFilters } from '../searchFilters';
import { parseStoredSearches, prependSearch, searchSignature } from '../searchHistory';

function filters(patch: Partial<SearchFilters> = {}): SearchFilters {
  return { ...EMPTY_FILTERS, ...patch };
}

describe('search history persistence', () => {
  it('recovers malformed or old storage without throwing', () => {
    expect(parseStoredSearches(null)).toEqual([]);
    expect(parseStoredSearches('{broken json')).toEqual([]);
    expect(parseStoredSearches(JSON.stringify([{ q: 'incomplete' }]))).toEqual([]);
  });

  it('normalizes restored searches to the first page and ignores invalid items', () => {
    const saved = { ...filters({ q: 'cold storage', city: 'Delhi', page: 4 }) };
    const restored = parseStoredSearches(JSON.stringify([saved, null, { q: 'bad' }]));
    expect(restored).toEqual([{ ...saved, page: 1 }]);
  });

  it('deduplicates equivalent searches even when pagination differs', () => {
    const first = filters({ q: '  warehouse  ', city: 'Pune', page: 1 });
    const second = { ...first, q: 'warehouse', page: 5 };
    expect(searchSignature(first)).toBe(searchSignature(second));
    expect(prependSearch([first], second)).toHaveLength(1);
  });

  it('moves the newest search to the front and respects the limit', () => {
    const old = [filters({ q: 'one' }), filters({ q: 'two' }), filters({ q: 'three' })];
    expect(prependSearch(old, filters({ q: 'four' }), 3).map((item) => item.q)).toEqual([
      'four',
      'one',
      'two',
    ]);
  });
});
