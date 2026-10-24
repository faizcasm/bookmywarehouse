/** Home screen — hero search, categories, featured listings. */

import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowRight } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SectionHeader,
  Skeleton,
} from '@/components/ui';
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
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={[styles.heroTitle, { color: t.fgStrong }]}>
          Find space for{'\n'}anything
        </Text>
        <Text style={[styles.heroSub, { color: t.muted }]}>
          Warehouses, equipment and logistics services — booked in minutes.
        </Text>
        <Pressable
          onPress={() => router.push('/(customer)/(tabs)/search')}
          style={({ pressed }) => [
            styles.searchBar,
            { backgroundColor: t.surface, borderColor: pressed ? t.lineStrong : t.line },
            pressed && { opacity: 0.9 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Search listings"
        >
          <View style={[styles.searchIcon, { backgroundColor: t.brand }]}>
            <Search size={18} color={t.brandFg} />
          </View>
          <Text style={{ color: t.faint, fontSize: 15, flex: 1 }}>Search by city, type or keyword</Text>
          <ArrowRight size={18} color={t.faint} />
        </Pressable>
      </View>

      {/* Categories */}
      {categories.data && categories.data.length ? (
        <View>
          <SectionHeader
            title="Browse by category"
            actionLabel="See all"
            onAction={() => router.push('/(customer)/(tabs)/search')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {categories.data.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() =>
                  router.push({
                    pathname: '/(customer)/(tabs)/search',
                    params: { categoryId: cat.id },
                  })
                }
                style={({ pressed }) => [
                  styles.catChip,
                  { backgroundColor: t.surface, borderColor: pressed ? t.lineStrong : t.line },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={{ color: t.fg, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                  {cat.name}
                </Text>
                {cat.listingCount != null ? (
                  <Text style={{ color: t.faint, fontSize: 12 }}>
                    {cat.listingCount} listing{cat.listingCount === 1 ? '' : 's'}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Featured — 2-up grid */}
      <View>
        <SectionHeader
          title="Featured spaces"
          actionLabel="View all"
          onAction={() => router.push('/(customer)/(tabs)/search')}
        />
        {featured.isLoading ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.gridItem}>
                <Skeleton height={190} radius={16} />
              </View>
            ))}
          </View>
        ) : featured.isError ? (
          <ErrorState error={featured.error} onRetry={() => featured.refetch()} />
        ) : featured.data && featured.data.items.length ? (
          <View style={styles.grid}>
            {featured.data.items.map((listing) => (
              <View key={listing.id} style={styles.gridItem}>
                <ListingCard
                  listing={listing}
                  variant="compact"
                  onPress={() => router.push(`/(customer)/listing/${listing.slug}`)}
                />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No listings yet"
            subtitle="Featured spaces will appear here once partners publish them."
          />
        )}
      </View>

      {/* Partner CTA */}
      <Card style={styles.cta}>
        <Text style={[styles.ctaTitle, { color: t.fgStrong }]}>Have space to rent?</Text>
        <Text style={{ color: t.muted, lineHeight: 20 }}>
          List your warehouse or equipment and reach thousands of businesses.
        </Text>
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
  hero: { gap: 6, paddingTop: 8, paddingBottom: 4 },
  heroTitle: { fontSize: 30, fontWeight: '800', lineHeight: 36, letterSpacing: -0.6 },
  heroSub: { fontSize: 15, lineHeight: 21 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  searchIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catRow: { gap: 10, paddingRight: 8 },
  catChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'flex-start',
    gap: 2,
    minWidth: 110,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  gridItem: { width: '47.5%' },
  cta: { gap: 4, marginTop: 8 },
  ctaTitle: { fontSize: 18, fontWeight: '800' },
});
