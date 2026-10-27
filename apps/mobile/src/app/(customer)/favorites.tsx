/** Favorites — the customer's saved listings, with one-tap remove. */

import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import { Button, EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listFavorites, toggleFavorite } from '@/services/api/account';

export default function FavoritesScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const favorites = useQuery({ queryKey: ['favorites'], queryFn: () => listFavorites({ limit: 50 }) });

  const remove = useMutation({
    mutationFn: (listingId: string) => toggleFavorite(listingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
    onError: (e) => Alert.alert('Could not remove', e instanceof Error ? e.message : 'Try again.'),
  });

  if (favorites.isLoading) {
    return (
      <Screen scroll>
        {[0, 1].map((i) => (
          <Skeleton key={i} height={220} radius={16} />
        ))}
      </Screen>
    );
  }
  if (favorites.isError) {
    return (
      <Screen>
        <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} />
      </Screen>
    );
  }

  const items = favorites.data?.items ?? [];
  if (!items.length) {
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
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Favorites</Text>
      <View style={styles.grid}>
        {items.map((fav) => (
          <View key={fav.id} style={styles.item}>
            <ListingCard
              listing={fav.listing}
              onPress={() => router.push(`/(customer)/listing/${fav.listing.slug}`)}
            />
            <Button
              label="Remove from favorites"
              variant="ghost"
              onPress={() => remove.mutate(fav.listing.id)}
              style={styles.remove}
            />
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '800' },
  grid: { gap: 16 },
  item: { gap: 4 },
  remove: { alignSelf: 'flex-start' },
});
