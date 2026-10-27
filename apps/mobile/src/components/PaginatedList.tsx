/**
 * PaginatedList — a reusable FlatList over a `Paginated<T>` query with loading
 * skeletons, error retry, empty state and "load more" paging. Every list-backed
 * screen uses this so paging/error/empty behaviour stays consistent.
 */

import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { Button, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import type { Paginated } from '@/types';

interface PaginatedListProps<T> {
  queryKey: readonly unknown[];
  fetchPage: (page: number) => Promise<Paginated<T>>;
  renderItem: (item: T) => React.ReactElement;
  keyExtractor: (item: T) => string;
  emptyTitle: string;
  emptySubtitle?: string;
  itemHeight?: number;
  /** Rendered above the rows (filters, summaries) but scrolls with them. */
  header?: React.ReactElement;
  /** Hide the built-in empty block (when the caller renders its own). */
  hideEmpty?: boolean;
}

export function PaginatedList<T>({
  queryKey,
  fetchPage,
  renderItem,
  keyExtractor,
  emptyTitle,
  emptySubtitle,
  itemHeight = 96,
  header,
  hideEmpty,
}: PaginatedListProps<T>) {
  const t = useTheme();

  // Accumulated extra pages are tagged with the queryKey they were fetched
  // under *and* the page-1 payload they were appended to. Switching filters,
  // searching, or a page-1 refetch therefore never bleeds stale results into
  // the list — the extra pages are simply ignored until reloaded.
  const key = JSON.stringify(queryKey);
  const [cursor, setCursor] = useState<{
    key: string;
    base: Paginated<T> | undefined;
    page: number;
    items: T[];
  }>({ key: '', base: undefined, page: 1, items: [] });
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: [...queryKey, 1],
    queryFn: () => fetchPage(1),
  });

  const fresh = cursor.key === key && cursor.base === query.data;
  const page = fresh ? cursor.page : 1;
  const extraItems = fresh ? cursor.items : [];

  const loadMore = useCallback(async () => {
    const first = query.data;
    const meta = first?.meta?.pagination;
    if (!first || !meta || page >= meta.totalPages || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await fetchPage(next);
      setCursor((prev) => ({
        key,
        base: first,
        page: next,
        items: prev.key === key && prev.base === first && prev.page === page
          ? [...prev.items, ...res.items]
          : res.items,
      }));
    } finally {
      setLoadingMore(false);
    }
  }, [query.data, page, loadingMore, fetchPage, key]);

  const data = query.data ? [...query.data.items, ...extraItems] : [];
  const meta = query.data?.meta?.pagination;

  const refetch = query.refetch;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  if (query.isLoading && !refreshing) {
    return (
      <View style={styles.list}>
        {header}
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={itemHeight} radius={16} />
        ))}
      </View>
    );
  }
  if (query.isError && !data.length) {
    return (
      <View style={styles.list}>
        {header}
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => renderItem(item)}
      contentContainerStyle={styles.list}
      onEndReachedThreshold={0.4}
      onEndReached={loadMore}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={header}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator color={t.brand} style={{ marginVertical: 16 }} />
        ) : meta && page < meta.totalPages ? (
          <Button label="Load more" variant="ghost" onPress={loadMore} style={{ marginTop: 8 }} />
        ) : undefined
      }
      ListEmptyComponent={
        !hideEmpty && data.length === 0 ? (
          <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12, flexGrow: 1 },
});
