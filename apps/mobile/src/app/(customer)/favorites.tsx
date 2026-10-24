/** Favorites — the customer's saved listings. */

import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import { EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listFavorites } from '@/services/api/account';
import { getListing } from '@/services/api/catalog';
import type { ListingDetail } from '@/types';

export default function FavoritesScreen() {
  const t = useTheme();

  const favIds = useQuery({ queryKey: ['favorites'], queryFn: () => listFavorites() });

  const listings = useQuery({
    queryKey: ['favorites-listings', favIds.data],
    queryFn: async () => {
      const results = await Promise.allSettled((favIds.data ?? []).map((id) => getListing(id)));
      return results
        .filter((r): r is PromiseFulfilledResult<ListingDetail> => r.status === 'fulfilled')
        .map((r) => r.value);
    },
    enabled: !!favIds.data,
  });

  if (favIds.isLoading || listings.isLoading) {
    return (
      <Screen scroll>
        {[0, 1].map((i) => (
          <Skeleton key={i} height={220} radius={16} />
        ))}
      </Screen>
    );
  }
  if (favIds.isError) {
    return (
      <Screen>
        <ErrorState error={favIds.error} onRetry={() => favIds.refetch()} />
      </Screen>
    );
  }

  const items = listings.data ?? [];
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
        {items.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onPress={() => router.push(`/(customer)/listing/${listing.slug}`)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '800' },
  grid: { gap: 16 },
});
