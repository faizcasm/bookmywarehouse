/** Search screen — query + filters + paginated results. */

import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import { Button, EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { searchListings, POPULAR_CITIES } from '@/services/api/catalog';
import {
  EMPTY_FILTERS,
  filtersToApiQuery,
  countActiveFilters,
  type SearchFilters,
} from '@/utils/searchFilters';

const SORTS = ['relevance', 'price_asc', 'price_desc', 'rating'];
const TYPES = ['', 'WAREHOUSE', 'EQUIPMENT', 'SERVICE'];

export default function SearchScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ q?: string; city?: string; categoryId?: string }>();

  const [filters, setFilters] = useState<SearchFilters>({
    ...EMPTY_FILTERS,
    q: params.q ?? '',
    city: params.city ?? '',
    categoryId: params.categoryId ?? '',
  });

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

  const query = useMemo(() => filtersToApiQuery(filters), [filters]);

  const results = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchListings({ ...query, limit: 20 }),
  });

  const activeCount = countActiveFilters(filters);
  const patch = (p: Partial<SearchFilters>) => setFilters((f) => ({ ...f, ...p, page: 1 }));

  return (
    <Screen padTop={false} style={styles.screen}>
      <View style={[styles.searchWrap, { backgroundColor: t.surface, borderColor: t.line }]}>
        <TextInput
          value={filters.q}
          onChangeText={(q) => patch({ q })}
          placeholder="Search warehouses, equipment…"
          placeholderTextColor={t.faint}
          style={[styles.searchInput, { color: t.fg }]}
          returnKeyType="search"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {TYPES.map((type) => (
          <Chip
            key={type || 'all'}
            label={type ? type.charAt(0) + type.slice(1).toLowerCase() : 'All'}
            active={filters.type === type}
            onPress={() => patch({ type })}
          />
        ))}
        <Chip label="Verified only" active={filters.verifiedOnly} onPress={() => patch({ verifiedOnly: !filters.verifiedOnly })} />
        {SORTS.map((sort) => (
          <Chip key={sort} label={sort.replace('_', ' ')} active={filters.sort === sort} onPress={() => patch({ sort })} />
        ))}
      </ScrollView>

      {POPULAR_CITIES.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Any city" active={!filters.city} onPress={() => patch({ city: '' })} />
          {POPULAR_CITIES.map((city) => (
            <Chip key={city} label={city} active={filters.city === city} onPress={() => patch({ city })} />
          ))}
        </ScrollView>
      ) : null}

      {activeCount > 0 ? (
        <View style={styles.metaRow}>
          <Text style={{ color: t.muted }}>
            {activeCount} filter{activeCount > 1 ? 's' : ''} · {results.data?.meta?.pagination?.totalItems ?? '—'} results
          </Text>
          <Button label="Clear" variant="ghost" onPress={() => setFilters({ ...EMPTY_FILTERS, q: filters.q })} />
        </View>
      ) : null}

      {results.isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={220} radius={16} />
          ))}
        </View>
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : results.data && results.data.items.length ? (
        <FlatList
          data={results.data.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListingCard listing={item} onPress={() => router.push(`/(customer)/listing/${item.slug}`)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <EmptyState
          title="No matches"
          subtitle="Try a different keyword or clear some filters."
          actionLabel={activeCount > 0 ? 'Clear filters' : undefined}
          onAction={activeCount > 0 ? () => setFilters(EMPTY_FILTERS) : undefined}
        />
      )}
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Text
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? t.brand : t.surface, borderColor: active ? t.brand : t.line, color: active ? t.brandFg : t.fg },
      ]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, gap: 10 },
  searchWrap: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  searchInput: { fontSize: 16, paddingVertical: 10 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '600',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
});