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
}

export function PaginatedList<T>({
  queryKey,
  fetchPage,
  renderItem,
  keyExtractor,
  emptyTitle,
  emptySubtitle,
  itemHeight = 96,
}: PaginatedListProps<T>) {
  const t = useTheme();
  const [pages, setPages] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useQuery({
    queryKey: [...queryKey, 1],
    queryFn: () => fetchPage(1),
  });

  const loadMore = useCallback(async () => {
    const meta = query.data?.meta?.pagination;
    if (!meta || page >= meta.totalPages || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await fetchPage(next);
      setPages((prev) => [...prev, ...res.items]);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }, [query.data, page, loadingMore, fetchPage]);

  const data = query.data ? [...query.data.items, ...pages] : [];
  const meta = query.data?.meta?.pagination;

  if (query.isLoading) {
    return (
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={itemHeight} radius={16} />
        ))}
      </View>
    );
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => renderItem(item)}
      contentContainerStyle={styles.list}
      onEndReachedThreshold={0.4}
      onEndReached={loadMore}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator color={t.brand} style={{ marginVertical: 16 }} />
        ) : meta && page < meta.totalPages ? (
          <Button label="Load more" variant="ghost" onPress={loadMore} style={{ marginTop: 8 }} />
        ) : undefined
      }
      ListEmptyComponent={
        data.length === 0 ? <EmptyState title={emptyTitle} subtitle={emptySubtitle} /> : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12, flexGrow: 1 },
});
