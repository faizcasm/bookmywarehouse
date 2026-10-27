/**
 * Search screen — query bar, filter bottom sheet and paginated results.
 *
 * Filters live in local state (synced from inbound route params) and are
 * serialized into the react-query key, so every filter combination gets its
 * own cache entry and PaginatedList can page past the first 20 results.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { BookmarkPlus, History, Search, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import { PaginatedList } from '@/components/PaginatedList';
import {
  Button,
  Card,
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
import { STORAGE_KEYS } from '@/constants/config';
import { parseStoredSearches, prependSearch, searchSignature } from '@/utils/searchHistory';
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

function searchLabel(filters: SearchFilters, categories: Map<string, string>): string {
  const parts: string[] = [];
  if (filters.q.trim()) parts.push(`“${filters.q.trim()}”`);
  if (filters.city) parts.push(filters.city);
  if (filters.type) parts.push(humanize(filters.type));
  if (filters.categoryId) parts.push(categories.get(filters.categoryId) ?? 'Category');
  if (filters.minPrice || filters.maxPrice) {
    parts.push(`₹${filters.minPrice || '0'}–${filters.maxPrice || 'any'}`);
  }
  if (filters.minRating) parts.push(`${filters.minRating}★+`);
  if (filters.verifiedOnly) parts.push('Verified');
  return parts.slice(0, 3).join(' · ') || 'All listings';
}

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
  const [recentSearches, setRecentSearches] = useState<SearchFilters[]>([]);
  const [savedSearches, setSavedSearches] = useState<SearchFilters[]>([]);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.recentSearches),
      AsyncStorage.getItem(STORAGE_KEYS.savedSearches),
    ])
      .then(([recentRaw, savedRaw]) => {
        if (!mounted) return;
        setRecentSearches(parseStoredSearches(recentRaw));
        setSavedSearches(parseStoredSearches(savedRaw));
      })
      .catch(() => {
        // Search remains fully usable when local persistence is unavailable.
      });
    return () => {
      mounted = false;
    };
  }, []);

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

  const rememberSearch = useCallback(
    (candidate: SearchFilters) => {
      if (countActiveFilters(candidate) === 0) return;
      const next = prependSearch(recentSearches, candidate, 8);
      setRecentSearches(next);
      AsyncStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(next)).catch(() => {});
    },
    [recentSearches],
  );

  const saveCurrentSearch = useCallback(() => {
    if (countActiveFilters(filters) === 0) {
      setSearchNotice('Add a keyword or filter before saving a search.');
      return;
    }
    const signature = searchSignature(filters);
    if (savedSearches.some((item) => searchSignature(item) === signature)) {
      setSearchNotice('This search is already saved on this device.');
      return;
    }
    const next = prependSearch(savedSearches, filters, 8);
    setSavedSearches(next);
    AsyncStorage.setItem(STORAGE_KEYS.savedSearches, JSON.stringify(next)).catch(() => {});
    rememberSearch(filters);
    setSearchNotice('Search saved on this device.');
  }, [filters, savedSearches, rememberSearch]);

  const applySearch = useCallback(
    (candidate: SearchFilters) => {
      setFilters({ ...candidate, page: 1 });
      setSearchNotice(null);
      rememberSearch(candidate);
    },
    [rememberSearch],
  );

  const removeSavedSearch = useCallback(
    (candidate: SearchFilters) => {
      const signature = searchSignature(candidate);
      const next = savedSearches.filter((item) => searchSignature(item) !== signature);
      setSavedSearches(next);
      AsyncStorage.setItem(STORAGE_KEYS.savedSearches, JSON.stringify(next)).catch(() => {});
    },
    [savedSearches],
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    AsyncStorage.removeItem(STORAGE_KEYS.recentSearches).catch(() => {});
  }, []);

  const patch = (p: Partial<SearchFilters>) => {
    setSearchNotice(null);
    setFilters((f) => ({ ...f, ...p, page: 1 }));
  };
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
            onSubmitEditing={() => rememberSearch(filters)}
            accessibilityLabel="Search listings"
          />
        </View>
        <Chip
          label="Filters"
          count={activeCount > 0 ? activeCount : undefined}
          selected={activeCount > 0}
          onPress={openFilters}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save this search"
          accessibilityState={{ disabled: activeCount === 0 }}
          disabled={activeCount === 0}
          onPress={saveCurrentSearch}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: t.name === 'dark' ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
              borderColor: activeCount > 0 ? t.brand : t.line,
              opacity: activeCount === 0 ? 0.5 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <BookmarkPlus size={18} color={activeCount > 0 ? t.brand : t.faint} />
        </Pressable>
      </View>

      {searchNotice ? (
        <View style={[styles.notice, { backgroundColor: t.brandSoft, borderColor: t.line }]}>
          <Text style={{ color: t.brandSoftFg, fontSize: 12.5, fontWeight: '600' }}>
            {searchNotice}
          </Text>
        </View>
      ) : null}

      {/* Saved and recent searches are kept locally on this device. */}
      {activeCount === 0 && !filters.q.trim() && (savedSearches.length > 0 || recentSearches.length > 0) ? (
        <Card padded={false} style={styles.discovery}>
          {savedSearches.length > 0 ? (
            <View style={styles.discoverySection}>
              <View style={styles.discoveryTitleRow}>
                <View style={styles.discoveryTitle}>
                  <BookmarkPlus size={15} color={t.brand} />
                  <Text style={[styles.discoveryHeading, { color: t.fgStrong }]}>Saved searches</Text>
                </View>
                <Text style={{ color: t.faint, fontSize: 11 }}>This device</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
                {savedSearches.map((preset) => (
                  <View
                    key={searchSignature(preset)}
                    style={[
                      styles.savedPreset,
                      {
                        backgroundColor: t.name === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.72)',
                        borderColor: t.line,
                      },
                    ]}
                  >
                    <Pressable
                      style={styles.savedPresetMain}
                      onPress={() => applySearch(preset)}
                      accessibilityRole="button"
                      accessibilityLabel={`Run saved search: ${searchLabel(preset, categoryName)}`}
                    >
                      <Text style={[styles.presetText, { color: t.fg }]} numberOfLines={1}>
                        {searchLabel(preset, categoryName)}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.removePreset}
                      onPress={() => removeSavedSearch(preset)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove saved search: ${searchLabel(preset, categoryName)}`}
                      hitSlop={6}
                    >
                      <X size={14} color={t.faint} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          {recentSearches.length > 0 ? (
            <View style={styles.discoverySection}>
              <View style={styles.discoveryTitleRow}>
                <View style={styles.discoveryTitle}>
                  <History size={15} color={t.muted} />
                  <Text style={[styles.discoveryHeading, { color: t.fgStrong }]}>Recent searches</Text>
                </View>
                <Pressable
                  onPress={clearRecentSearches}
                  accessibilityRole="button"
                  accessibilityLabel="Clear recent searches"
                  hitSlop={8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Trash2 size={12} color={t.brand} />
                  <Text style={{ color: t.brand, fontSize: 12, fontWeight: '700' }}>Clear</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
                {recentSearches.map((preset) => (
                  <Chip
                    key={searchSignature(preset)}
                    label={searchLabel(preset, categoryName)}
                    size="sm"
                    onPress={() => applySearch(preset)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </Card>
      ) : null}

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
                rememberSearch(draft);
                setSearchNotice(null);
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
  saveButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  notice: { marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  discovery: { marginHorizontal: 16, padding: 12, gap: 12 },
  discoverySection: { gap: 8 },
  discoveryTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discoveryTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  discoveryHeading: { fontSize: 13, fontWeight: '800' },
  presetRow: { gap: 8, paddingRight: 2 },
  savedPreset: { maxWidth: 270, minHeight: 36, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  savedPresetMain: { paddingVertical: 8, paddingLeft: 11, paddingRight: 4, flexShrink: 1 },
  presetText: { fontSize: 12.5, fontWeight: '600' },
  removePreset: { paddingHorizontal: 8, paddingVertical: 9 },
  quickRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 2 },
  results: { flex: 1 },
  count: { fontSize: 13, fontWeight: '600' },
  sheetLabel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceRow: { flexDirection: 'row', gap: 10 },
  sheetFooter: { flexDirection: 'row', gap: 10 },
});
