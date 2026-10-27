/**
 * Search screen — query bar, filter bottom sheet and paginated results.
 *
 * Filters live in local state (synced from inbound route params) and are
 * serialized into the react-query key, so every filter combination gets its
 * own cache entry and PaginatedList can page past the first 20 results.
 */

import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import { PaginatedList } from '@/components/PaginatedList';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Screen,
  Segmented,
  Sheet,
  Skeleton,
  TextField,
} from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getCategories, searchListings, POPULAR_CITIES } from '@/services/api/catalog';
import {
  EMPTY_FILTERS,
  filtersToApiQuery,
  countActiveFilters,
  type SearchFilters,
} from '@/utils/searchFilters';
import { humanize } from '@/utils/format';
import type { ListingSummary } from '@/types';

const TYPES = ['', 'WAREHOUSE', 'EQUIPMENT', 'SERVICE'];

const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating_desc', label: 'Top rated' },
  { value: 'capacity_desc', label: 'Biggest capacity' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

const PAGE_SIZE = 20;

export default function SearchScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ q?: string; city?: string; categoryId?: string }>();

  const [filters, setFilters] = useState<SearchFilters>({
    ...EMPTY_FILTERS,
    q: params.q ?? '',
    city: params.city ?? '',
    categoryId: params.categoryId ?? '',
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilters>(filters);

  // Re-sync when inbound params change (e.g. tapping a category on Home).
  // Done during render (React's "adjusting state when props change" pattern)
  // rather than in an effect, so the first frame never shows stale results.
  const paramKey = `${params.q ?? ''}|${params.city ?? ''}|${params.categoryId ?? ''}`;
  const [lastParamKey, setLastParamKey] = useState(paramKey);
  if (lastParamKey !== paramKey) {
    setLastParamKey(paramKey);
    setFilters((f) => ({
      ...f,
      q: params.q ?? f.q,
      city: params.city ?? f.city,
      categoryId: params.categoryId ?? f.categoryId,
      page: 1,
    }));
  }

  const apiQuery = useMemo(() => filtersToApiQuery(filters), [filters]);
  const resultKey = JSON.stringify(apiQuery);

  const categories = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const categoryName = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories.data ?? []) map.set(cat.id, cat.name);
    return map;
  }, [categories.data]);

  // Shares its cache entry with PaginatedList's page-1 query (identical key),
  // so the header count costs no extra request.
  const head = useQuery({
    queryKey: ['search', resultKey, 1],
    queryFn: () => searchListings({ ...apiQuery, page: 1, limit: PAGE_SIZE }),
  });

  const fetchPage = useCallback(
    (page: number) => searchListings({ ...apiQuery, page, limit: PAGE_SIZE }),
    [apiQuery],
  );

  const activeCount = countActiveFilters(filters);
  const patch = (p: Partial<SearchFilters>) => setFilters((f) => ({ ...f, ...p, page: 1 }));
  const patchDraft = (p: Partial<SearchFilters>) => setDraft((f) => ({ ...f, ...p }));
  const clearFilters = () => setFilters((f) => ({ ...EMPTY_FILTERS, q: f.q }));
  const openFilters = () => {
    setDraft(filters);
    setSheetOpen(true);
  };

  const draftMin = Number(draft.minPrice);
  const draftMax = Number(draft.maxPrice);
  const priceInvalid =
    draft.minPrice !== '' &&
    draft.maxPrice !== '' &&
    Number.isFinite(draftMin) &&
    Number.isFinite(draftMax) &&
    draftMin > draftMax;

  const quickChips: { key: string; label: string; onClear: () => void }[] = [];
  if (filters.q) quickChips.push({ key: 'q', label: `“${filters.q}”`, onClear: () => patch({ q: '' }) });
  if (filters.type) {
    quickChips.push({ key: 'type', label: humanize(filters.type), onClear: () => patch({ type: '' }) });
  }
  if (filters.city) quickChips.push({ key: 'city', label: filters.city, onClear: () => patch({ city: '' }) });
  if (filters.categoryId) {
    quickChips.push({
      key: 'category',
      label: categoryName.get(filters.categoryId) ?? 'Category',
      onClear: () => patch({ categoryId: '' }),
    });
  }
  if (filters.minPrice || filters.maxPrice) {
    quickChips.push({
      key: 'price',
      label: `₹${filters.minPrice || '0'} – ${filters.maxPrice ? `₹${filters.maxPrice}` : 'any'}`,
      onClear: () => patch({ minPrice: '', maxPrice: '' }),
    });
  }
  if (filters.minRating) {
    quickChips.push({
      key: 'rating',
      label: `${filters.minRating}★ & up`,
      onClear: () => patch({ minRating: '' }),
    });
  }
  if (filters.verifiedOnly) {
    quickChips.push({ key: 'verified', label: 'Verified only', onClear: () => patch({ verifiedOnly: false }) });
  }

  const emptyNow = head.data !== undefined && head.data.items.length === 0;

  return (
    <Screen style={styles.screen}>
      {/* Search bar + filters trigger */}
      <View style={styles.topBar}>
        <View style={[styles.searchWrap, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Search size={17} color={t.faint} style={styles.searchIcon} />
          <TextInput
            value={filters.q}
            onChangeText={(q) => patch({ q })}
            placeholder="Search warehouses, equipment…"
            placeholderTextColor={t.faint}
            style={[styles.searchInput, { color: t.fg }]}
            returnKeyType="search"
            accessibilityLabel="Search listings"
          />
        </View>
        <Chip
          label="Filters"
          count={activeCount > 0 ? activeCount : undefined}
          selected={activeCount > 0}
          onPress={openFilters}
        />
      </View>

      {/* Active filters, one removable chip each */}
      {quickChips.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
        >
          {quickChips.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              selected
              size="sm"
              onPress={chip.onClear}
            />
          ))}
          <Chip label="Clear all" size="sm" onPress={clearFilters} />
        </ScrollView>
      ) : null}

      {/* Results */}
      <View style={styles.results}>
        {head.isError && !head.data ? (
          <ErrorState error={head.error} onRetry={() => head.refetch()} />
        ) : emptyNow ? (
          <EmptyState
            title="No matches"
            subtitle="Try a different keyword or clear some filters."
            actionLabel={activeCount > 0 ? 'Clear filters' : undefined}
            onAction={activeCount > 0 ? clearFilters : undefined}
          />
        ) : (
          <PaginatedList<ListingSummary>
            queryKey={['search', resultKey]}
            fetchPage={fetchPage}
            keyExtractor={(item) => item.id}
            itemHeight={252}
            hideEmpty
            emptyTitle="No matches"
            header={
              head.data ? (
                <Text style={[styles.count, { color: t.muted }]}>
                  {head.data.meta?.pagination?.totalItems ?? head.data.items.length} result
                  {(head.data.meta?.pagination?.totalItems ?? head.data.items.length) === 1 ? '' : 's'}
                </Text>
              ) : (
                <Skeleton height={18} />
              )
            }
            renderItem={(item) => (
              <ListingCard
                listing={item}
                onPress={() => router.push(`/(customer)/listing/${item.slug}`)}
              />
            )}
          />
        )}
      </View>

      {/* Filter sheet — edits a draft that is only applied on "Show results". */}
      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        subtitle="Narrow down the listings that match your job."
        dismissOnBackdrop={false}
        footer={
          <View style={styles.sheetFooter}>
            <Button
              label="Reset"
              variant="secondary"
              onPress={() => setDraft({ ...EMPTY_FILTERS, q: draft.q })}
            />
            <Button
              label="Show results"
              onPress={() => {
                setFilters({ ...draft, page: 1 });
                setSheetOpen(false);
              }}
              disabled={priceInvalid}
              style={styles.flex}
            />
          </View>
        }
      >
        <Text style={[styles.sheetLabel, { color: t.fgStrong }]}>Listing type</Text>
        <Segmented
          value={draft.type}
          onChange={(type) => patchDraft({ type })}
          options={TYPES.map((type) => ({
            value: type,
            label: type ? humanize(type) : 'All',
          }))}
        />

        <Text style={[styles.sheetLabel, { color: t.fgStrong }]}>City</Text>
        <View style={styles.wrapRow}>
          <Chip label="Any city" selected={!draft.city} onPress={() => patchDraft({ city: '' })} />
          {POPULAR_CITIES.map((city) => (
            <Chip
              key={city}
              label={city}
              selected={draft.city === city}
              onPress={() => patchDraft({ city: draft.city === city ? '' : city })}
            />
          ))}
        </View>

        <Text style={[styles.sheetLabel, { color: t.fgStrong }]}>Category</Text>
        {categories.isLoading ? (
          <Skeleton height={34} />
        ) : categories.isError ? (
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Categories are unavailable right now — you can still filter by type and city.
          </Text>
        ) : (
          <View style={styles.wrapRow}>
            <Chip label="All categories" selected={!draft.categoryId} onPress={() => patchDraft({ categoryId: '' })} />
            {(categories.data ?? []).map((cat) => (
              <Chip
                key={cat.id}
                label={cat.name}
                count={cat.listingCount}
                selected={draft.categoryId === cat.id}
                onPress={() => patchDraft({ categoryId: draft.categoryId === cat.id ? '' : cat.id })}
              />
            ))}
          </View>
        )}

        <Text style={[styles.sheetLabel, { color: t.fgStrong }]}>Price per period (₹)</Text>
        <View style={styles.priceRow}>
          <TextField
            label="Min"
            value={draft.minPrice}
            onChangeText={(minPrice) => patchDraft({ minPrice: minPrice.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            placeholder="0"
            style={styles.flex}
            error={priceInvalid ? 'Must be below max' : undefined}
          />
          <TextField
            label="Max"
            value={draft.maxPrice}
            onChangeText={(maxPrice) => patchDraft({ maxPrice: maxPrice.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            placeholder="Any"
            style={styles.flex}
          />
        </View>

        <Text style={[styles.sheetLabel, { color: t.fgStrong }]}>Minimum rating</Text>
        <View style={styles.wrapRow}>
          <Chip label="Any" selected={!draft.minRating} onPress={() => patchDraft({ minRating: '' })} />
          {['1', '2', '3', '4', '5'].map((rating) => (
            <Chip
              key={rating}
              label={`${rating}★ & up`}
              selected={draft.minRating === rating}
              onPress={() => patchDraft({ minRating: draft.minRating === rating ? '' : rating })}
            />
          ))}
        </View>

        <Text style={[styles.sheetLabel, { color: t.fgStrong }]}>Trust</Text>
        <View style={styles.wrapRow}>
          <Chip
            label="Verified partners only"
            selected={draft.verifiedOnly}
            onPress={() => patchDraft({ verifiedOnly: !draft.verifiedOnly })}
          />
        </View>

        <Text style={[styles.sheetLabel, { color: t.fgStrong }]}>Sort by</Text>
        <View style={styles.wrapRow}>
          {SORTS.map((sort) => (
            <Chip
              key={sort.value}
              label={sort.label}
              selected={draft.sort === sort.value}
              onPress={() => patchDraft({ sort: sort.value })}
            />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, gap: 10 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  quickRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 2 },
  results: { flex: 1 },
  count: { fontSize: 13, fontWeight: '600' },
  sheetLabel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceRow: { flexDirection: 'row', gap: 10 },
  sheetFooter: { flexDirection: 'row', gap: 10 },
});
