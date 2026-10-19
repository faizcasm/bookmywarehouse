import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import {
  EMPTY_FILTERS,
  buildSearchQuery,
  countActiveFilters,
  filtersFromParams,
  filtersToApiQuery,
} from '../lib/searchFilters';
import { formatMoney, listingTypeLabel } from '../lib/format';
import type { SearchResponseDTO } from '../lib/types';
import { ListingCard } from '../components/ListingCard';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/Skeleton';
import { Pagination } from '../components/Pagination';

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SERVICE', label: 'Service' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating_desc', label: 'Top rated' },
  { value: 'capacity_desc', label: 'Largest capacity' },
];

const RATING_OPTIONS = [
  { value: '', label: 'Any rating' },
  { value: '3', label: '3.0+ stars' },
  { value: '4', label: '4.0+ stars' },
  { value: '4.5', label: '4.5+ stars' },
];

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const activeCount = countActiveFilters(filters);

  const [cityDraft, setCityDraft] = useState(filters.city);
  useEffect(() => setCityDraft(filters.city), [filters.city]);
  useEffect(() => {
    if (cityDraft === filters.city) return undefined;
    const timer = window.setTimeout(() => {
      update({ city: cityDraft });
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityDraft]);

  function update(patch: Partial<typeof filters>, resetPage = true) {
    const next = { ...filters, ...patch };
    if (resetPage && !('page' in patch)) next.page = 1;
    setSearchParams(buildSearchQuery(next), { replace: false });
  }

  const results = useAsyncData(() => api.getWithMeta<SearchResponseDTO>('/catalog/search', filtersToApiQuery(filters)), [
    searchParams.toString(),
  ]);

  const pagination = results.data?.meta?.pagination;
  const payload = results.data?.data;

  return (
    <div className="container page search-page">
      <div className="page-head">
        <h1>Explore the marketplace</h1>
        <p className="muted">
          {results.data?.meta?.pagination
            ? `${results.data.meta.pagination.total} listing${results.data.meta.pagination.total === 1 ? '' : 's'} found`
            : 'Search warehouses, equipment and services across India'}
        </p>
      </div>

      <div className="search-layout">
        <aside className="card filter-sidebar" aria-label="Search filters">
          <div className="filter-head">
            <h2>Filters {activeCount > 0 ? <span className="badge tone-accent">{activeCount}</span> : null}</h2>
            {activeCount > 0 ? (
              <button type="button" className="link-btn" onClick={() => setSearchParams(new URLSearchParams())}>
                Clear all
              </button>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="filter-type">Listing type</label>
            <select
              id="filter-type"
              className="select"
              value={filters.type}
              onChange={(event) => update({ type: event.target.value })}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filter-city">City</label>
            <input
              id="filter-city"
              className="input"
              type="text"
              placeholder="e.g. Pune"
              list="city-suggestions"
              value={cityDraft}
              onChange={(event) => setCityDraft(event.target.value)}
            />
            <datalist id="city-suggestions">
              {(payload?.facets?.cities ?? []).map((city) => (
                <option key={city.value} value={city.value}>
                  {city.count}
                </option>
              ))}
            </datalist>
          </div>

          <fieldset className="field">
            <legend>Price per period (₹)</legend>
            <div className="field-row">
              <input
                className="input"
                type="number"
                min={0}
                aria-label="Minimum price"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(event) => update({ minPrice: event.target.value })}
              />
              <input
                className="input"
                type="number"
                min={0}
                aria-label="Maximum price"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(event) => update({ maxPrice: event.target.value })}
              />
            </div>
            {payload?.facets?.priceRange ? (
              <p className="field-hint">
                Listed range: {formatMoney(payload?.facets?.priceRange?.min)} –{' '}
                {formatMoney(payload?.facets?.priceRange?.max)}
              </p>
            ) : null}
          </fieldset>

          <div className="field">
            <label htmlFor="filter-capacity">Minimum capacity</label>
            <input
              id="filter-capacity"
              className="input"
              type="number"
              min={0}
              placeholder="e.g. 500"
              value={filters.capacityMin}
              onChange={(event) => update({ capacityMin: event.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="filter-amenities">Amenities contain</label>
            <input
              id="filter-amenities"
              className="input"
              type="text"
              placeholder="e.g. CCTV, power backup"
              value={filters.amenities}
              onChange={(event) => update({ amenities: event.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="filter-rating">Minimum rating</label>
            <select
              id="filter-rating"
              className="select"
              value={filters.minRating}
              onChange={(event) => update({ minRating: event.target.value })}
            >
              {RATING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={(event) => update({ verifiedOnly: event.target.checked })}
            />
            <span>Verified partners only</span>
          </label>

          <div className="field">
            <label htmlFor="filter-sort">Sort by</label>
            <select
              id="filter-sort"
              className="select"
              value={filters.sort}
              onChange={(event) => update({ sort: event.target.value })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <section className="search-results" aria-label="Search results" aria-busy={results.loading}>
          {results.loading ? (
            <SkeletonGrid count={6} />
          ) : results.error ? (
            <ErrorState message={results.error.message} onRetry={results.reload} />
          ) : (payload?.items ?? []).length === 0 ? (
            <EmptyState
              title="No listings match your filters"
              message="Try widening the price range, removing the city or clearing filters."
              action={
                activeCount > 0 ? (
                  <button type="button" className="btn btn-outline" onClick={() => setSearchParams(new URLSearchParams())}>
                    Clear all filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              {filters.q ? (
                <p className="results-note">
                  Results for <strong>“{filters.q}”</strong>
                  {filters.type ? ` in ${listingTypeLabel(filters.type).toLowerCase()}s` : ''}
                </p>
              ) : null}
              <div className="grid grid-cards">
                {(payload?.items ?? []).map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              <Pagination
                pagination={pagination ?? null}
                onPageChange={(page) => {
                  update({ page }, false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
