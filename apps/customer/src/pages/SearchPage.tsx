import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Filter, X, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { useDocumentMeta } from '../lib/useDocumentMeta';
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
import { fadeUp, stagger, fadeSoft } from '@bmw/ui';

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

  useDocumentMeta({
    title: 'Search warehouses, equipment & services — BookMyWarehouse',
    description:
      'Search warehouses, equipment and logistics services across India. Filter by city, type, capacity and price to find the right space or machine.',
  });

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const update = useCallback((patch: Partial<typeof filters>, resetPage = true) => {
    const next = { ...filters, ...patch };
    if (resetPage && !('page' in patch)) next.page = 1;
    setSearchParams(buildSearchQuery(next), { replace: false });
  }, [filters, setSearchParams]);

  const [cityDraft, setCityDraft] = useState(filters.city);
  useEffect(() => setCityDraft(filters.city), [filters.city]);
  useEffect(() => {
    if (cityDraft === filters.city) return undefined;
    const timer = window.setTimeout(() => {
      update({ city: cityDraft });
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityDraft, update]);

  const results = useAsyncData(
    () => api.getWithMeta<SearchResponseDTO>('/catalog/search', filtersToApiQuery(filters)),
    [searchParams.toString()],
  );

  const pagination = results.data?.meta?.pagination;
  const payload = results.data?.data;

  // Build active filter chips
  const activeFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (filters.q) chips.push({ key: 'q', label: `Keyword: "${filters.q}"`, onRemove: () => update({ q: '' }) });
    if (filters.type) chips.push({ key: 'type', label: `Type: ${listingTypeLabel(filters.type)}`, onRemove: () => update({ type: '' }) });
    if (filters.city) chips.push({ key: 'city', label: `City: ${filters.city}`, onRemove: () => update({ city: '' }) });
    if (filters.minPrice) chips.push({ key: 'minPrice', label: `Min price: ${formatMoney(Number(filters.minPrice))}`, onRemove: () => update({ minPrice: '' }) });
    if (filters.maxPrice) chips.push({ key: 'maxPrice', label: `Max price: ${formatMoney(Number(filters.maxPrice))}`, onRemove: () => update({ maxPrice: '' }) });
    if (filters.capacityMin) chips.push({ key: 'capacityMin', label: `Capacity: ${filters.capacityMin}+`, onRemove: () => update({ capacityMin: '' }) });
    if (filters.amenities) chips.push({ key: 'amenities', label: `Amenities: ${filters.amenities}`, onRemove: () => update({ amenities: '' }) });
    if (filters.minRating) chips.push({ key: 'minRating', label: `Rating: ${filters.minRating}+`, onRemove: () => update({ minRating: '' }) });
    if (filters.verifiedOnly) chips.push({ key: 'verifiedOnly', label: 'Verified only', onRemove: () => update({ verifiedOnly: false }) });
    return chips;
  }, [filters, update]);

  return (
    <div className="container page search-page">
      <motion.div className="page-head reveal" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1>Explore the marketplace</h1>
        <p className="muted">
          {results.data?.meta?.pagination
            ? `${results.data.meta.pagination.total} listing${results.data.meta.pagination.total === 1 ? '' : 's'} found`
            : 'Search warehouses, equipment and services across India'}
        </p>
      </motion.div>

      {/* Active filter chips bar */}
      {activeFilters.length > 0 && (
        <motion.div className="active-filters-bar reveal" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.25 }} style={{ marginBottom: '1rem' }}>
          <div className="active-filters-scroll">
            {activeFilters.map((chip) => (
              <motion.span key={chip.key} className="badge tone-accent active-filter-chip" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                {chip.label}
                <button type="button" className="filter-chip-remove" onClick={chip.onRemove} aria-label={`Remove filter: ${chip.label}`}>
                  <X size={10} aria-hidden="true" />
                </button>
              </motion.span>
            ))}
            <motion.button
              type="button"
              className="link-btn"
              onClick={() => setSearchParams(new URLSearchParams())}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Clear all
            </motion.button>
          </div>
        </motion.div>
      )}

      <div className="search-layout">
        {/* Desktop filter sidebar */}
        <aside
          className={`filter-sidebar card glass ${mobileFiltersOpen ? 'mobile-open' : ''}`}
          aria-label="Search filters"
        >
          <div className="filter-head">
            <h2>
              Filters
              {activeCount > 0 && <span className="badge tone-accent">{activeCount}</span>}
            </h2>
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

        {/* Mobile filter drawer trigger */}
        <button
          type="button"
          className="mobile-filters-trigger btn btn-outline"
          onClick={() => setMobileFiltersOpen(true)}
          aria-expanded={mobileFiltersOpen}
          aria-controls="mobile-filters-drawer"
        >
          <Filter size={16} aria-hidden="true" />
          Filters
          {activeCount > 0 && <span className="badge-count">{activeCount}</span>}
        </button>

        {/* Mobile filter drawer */}
        <AnimatePresence>
          {mobileFiltersOpen && (
            <motion.div
              id="mobile-filters-drawer"
              className="mobile-filters-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileFiltersOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Search filters"
            >
              <motion.aside
                className="mobile-filters-drawer card glass-strong"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mobile-filters-header">
                  <h2>Filters</h2>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setMobileFiltersOpen(false)}
                    aria-label="Close filters"
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </div>
                <div className="mobile-filters-content">
                  {/* Same filter form content */}
                  <div className="field">
                    <label htmlFor="mobile-filter-type">Listing type</label>
                    <select
                      id="mobile-filter-type"
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
                    <label htmlFor="mobile-filter-city">City</label>
                    <input
                      id="mobile-filter-city"
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
                    <label htmlFor="mobile-filter-capacity">Minimum capacity</label>
                    <input
                      id="mobile-filter-capacity"
                      className="input"
                      type="number"
                      min={0}
                      placeholder="e.g. 500"
                      value={filters.capacityMin}
                      onChange={(event) => update({ capacityMin: event.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="mobile-filter-amenities">Amenities contain</label>
                    <input
                      id="mobile-filter-amenities"
                      className="input"
                      type="text"
                      placeholder="e.g. CCTV, power backup"
                      value={filters.amenities}
                      onChange={(event) => update({ amenities: event.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="mobile-filter-rating">Minimum rating</label>
                    <select
                      id="mobile-filter-rating"
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
                    <label htmlFor="mobile-filter-sort">Sort by</label>
                    <select
                      id="mobile-filter-sort"
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

                  {activeCount > 0 && (
                    <button type="button" className="btn btn-danger-ghost btn-block" onClick={() => setSearchParams(new URLSearchParams())}>
                      Clear all filters
                    </button>
                  )}
                </div>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.section
          className="search-results"
          aria-label="Search results"
          aria-busy={results.loading}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
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
                <motion.p className="results-note" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                  Results for <strong>“{filters.q}”</strong>
                  {filters.type ? ` in ${listingTypeLabel(filters.type).toLowerCase()}s` : ''}
                </motion.p>
              ) : null}
              <motion.div
                className="grid grid-cards"
                variants={stagger(0.07)}
                initial="hidden"
                animate="show"
              >
                <AnimatePresence mode="popLayout">
                  {(payload?.items ?? []).map((listing) => (
                    <motion.div key={listing.id} variants={fadeSoft}>
                      <ListingCard listing={listing} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Pagination
                  pagination={pagination ?? null}
                  onPageChange={(page) => {
                    update({ page }, false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </motion.div>
            </>
          )}
        </motion.section>
      </div>
    </div>
  );
}