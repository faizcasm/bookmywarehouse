/** Home screen — hero search, categories, featured listings. */

import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import { Button, Card, EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getCategories, searchListings } from '@/services/api/catalog';

export default function HomeScreen() {
  const t = useTheme();

  const featured = useQuery({
    queryKey: ['search', 'featured'],
    queryFn: () => searchListings({ sort: 'relevance', limit: 6, verifiedOnly: 'true' }),
  });

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={[styles.heroTitle, { color: t.fgStrong }]}>Find space for anything</Text>
        <Text style={[styles.heroSub, { color: t.muted }]}>
          Warehouses, equipment and logistics services, booked in minutes.
        </Text>
        <Pressable
          onPress={() => router.push('/(customer)/(tabs)/search')}
          style={[styles.searchBar, { backgroundColor: t.surface, borderColor: t.line }]}
          accessibilityRole="button"
        >
          <Search size={20} color={t.faint} />
          <Text style={{ color: t.faint, fontSize: 16 }}>Search by city, type or keyword</Text>
        </Pressable>
      </View>

      {categories.data && categories.data.length ? (
        <View>
          <Text style={[styles.sectionTitle, { color: t.fgStrong }]}>Browse by category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {categories.data.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() =>
                  router.push({ pathname: '/(customer)/(tabs)/search', params: { categoryId: cat.id } })
                }
                style={[styles.catChip, { backgroundColor: t.surface, borderColor: t.line }]}
              >
                <Text style={{ color: t.fg, fontWeight: '600' }}>{cat.name}</Text>
                {cat.listingCount != null ? (
                  <Text style={{ color: t.faint, fontSize: 12 }}>{cat.listingCount}</Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View>
        <Text style={[styles.sectionTitle, { color: t.fgStrong }]}>Featured spaces</Text>
        {featured.isLoading ? (
          <View style={styles.grid}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={220} radius={16} />
            ))}
          </View>
        ) : featured.isError ? (
          <ErrorState error={featured.error} onRetry={() => featured.refetch()} />
        ) : featured.data && featured.data.items.length ? (
          <View style={styles.grid}>
            {featured.data.items.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onPress={() => router.push(`/(customer)/listing/${listing.slug}`)}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="No listings yet" subtitle="Featured spaces will appear here once partners publish them." />
        )}
      </View>

      <Card style={styles.cta}>
        <Text style={[styles.ctaTitle, { color: t.fgStrong }]}>Have space to rent?</Text>
        <Text style={{ color: t.muted }}>List your warehouse or equipment and reach thousands of businesses.</Text>
        <Button
          label="Become a partner"
          onPress={() => router.push('/(auth)/register')}
          variant="secondary"
          style={{ marginTop: 12 }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 6, paddingVertical: 8 },
  heroTitle: { fontSize: 28, fontWeight: '800' },
  heroSub: { fontSize: 15, lineHeight: 21 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  catRow: { gap: 8, paddingRight: 8 },
  catChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  grid: { gap: 16 },
  cta: { gap: 4, marginTop: 8 },
  ctaTitle: { fontSize: 17, fontWeight: '700' },
});