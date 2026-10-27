/** Favorites — the customer's saved listings, with one-tap remove. */

import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { ListingCard } from '@/components/ListingCard';
import { EmptyState, ErrorState, Screen, SignInPrompt, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { listFavorites, toggleFavorite } from '@/services/api/account';
import { formatDate } from '@/utils/format';
import type { Favorite, Paginated } from '@/types';

export default function FavoritesScreen() {
  const t = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();

  // Optimistically drop the card, then let the server toggle confirm. On
  // failure every cached page is restored before a refetch is requested.
  const remove = useMutation({
    mutationFn: (listingId: string) => toggleFavorite(listingId),
    onMutate: async (listingId) => {
      await qc.cancelQueries({ queryKey: ['favorites'] });
      const previous = qc.getQueriesData<Paginated<Favorite>>({ queryKey: ['favorites'] });
      qc.setQueriesData<Paginated<Favorite>>({ queryKey: ['favorites'] }, (prev) =>
        prev ? { ...prev, items: prev.items.filter((f) => f.listing.id !== listingId) } : prev,
      );
      return { previous };
    },
    onError: (_err, _listingId, context) => {
      for (const [key, data] of context?.previous ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  // Page-1 head query — shares its cache entry with PaginatedList (identical
  // key) so the empty state can carry a "Browse listings" action.
  const head = useQuery({
    queryKey: ['favorites', 1],
    queryFn: () => listFavorites({ page: 1, limit: 10 }),
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to see your favorites"
          subtitle="Save listings while you browse and find them here on any device."
          next="/(customer)/favorites"
        />
      </Screen>
    );
  }

  if (head.isLoading) {
    return (
      <Screen scroll>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Favorites</Text>
        {[0, 1].map((i) => (
          <Skeleton key={i} height={250} radius={16} />
        ))}
      </Screen>
    );
  }

  if (head.isError) {
    return (
      <Screen>
        <ErrorState error={head.error} onRetry={() => head.refetch()} />
      </Screen>
    );
  }

  if (head.data && head.data.items.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="No favorites yet"
          subtitle="Save any listing to keep it here for later."
          actionLabel="Browse listings"
          onAction={() => router.push('/(customer)/(tabs)/search')}
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <PaginatedList<Favorite>
        queryKey={['favorites']}
        fetchPage={(page) => listFavorites({ page, limit: 10 })}
        keyExtractor={(fav) => fav.id}
        itemHeight={300}
        hideEmpty
        emptyTitle="No favorites yet"
        emptySubtitle="Tap the heart on any listing to keep it here for later."
        header={
          <Text style={[styles.heading, { color: t.fgStrong }]}>Favorites</Text>
        }
        renderItem={(fav) => (
          <View style={styles.item}>
            <ListingCard
              listing={fav.listing}
              showFavorite={false}
              onPress={() => router.push(`/(customer)/listing/${fav.listing.slug}`)}
            />
            <View style={styles.footer}>
              <Text style={[styles.saved, { color: t.faint }]}>
                Saved {formatDate(fav.createdAt)}
              </Text>
              <Pressable
                onPress={() => remove.mutate(fav.listing.id)}
                disabled={remove.isPending && remove.variables === fav.listing.id}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${fav.listing.title} from favorites`}
                style={({ pressed }) => [styles.remove, pressed && { opacity: 0.7 }]}
              >
                <Trash2 size={15} color={t.danger} />
                <Text style={[styles.removeText, { color: t.danger }]}>
                  {remove.isPending && remove.variables === fav.listing.id ? 'Removing…' : 'Remove'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  heading: { fontSize: 22, fontWeight: '800' },
  item: { gap: 6 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  saved: { fontSize: 12.5 },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 8,
  },
  removeText: { fontSize: 13, fontWeight: '700' },
});
