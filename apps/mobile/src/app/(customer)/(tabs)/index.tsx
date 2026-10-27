/**
 * Home screen — platform banners, hero search, categories and featured listings.
 *
 * The announcement / maintenance banners come from the public platform
 * settings endpoint so ops can reach every user without an app release.
 */

import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowRight, Store } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SectionHeader,
  Skeleton,
} from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getCategories, getPlatformSettings, searchListings } from '@/services/api/catalog';
import { formatNumber } from '@/utils/format';

export default function HomeScreen() {
  const t = useTheme();

  const settings = useQuery({
    queryKey: ['platform-settings'],
    queryFn: getPlatformSettings,
    staleTime: 5 * 60_000,
  });

  const featured = useQuery({
    queryKey: ['search', 'featured'],
    queryFn: () => searchListings({ sort: 'relevance', limit: 6, verifiedOnly: 'true' }),
  });

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const maintenance = settings.data?.maintenanceMode === true;
  const announcement = settings.data?.announcement?.trim() || null;

  return (
    <Screen scroll>
      {/* Platform notices — ops-controlled, only rendered when set. */}
      {maintenance ? (
        <Banner
          tone="warn"
          title="Scheduled maintenance"
          message="Some actions may be unavailable while we make improvements. You can still browse listings."
        />
      ) : null}
      {announcement ? <Banner tone="info" message={announcement} /> : null}

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
      {categories.isLoading ? (
        <View style={styles.catRow}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={120} height={62} radius={14} />
          ))}
        </View>
      ) : categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} title="Couldn't load categories" />
      ) : categories.data && categories.data.length ? (
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
                accessibilityRole="button"
                accessibilityLabel={`Browse ${cat.name}${
                  cat.listingCount != null ? `, ${cat.listingCount} listings` : ''
                }`}
              >
                <Text style={{ color: t.fg, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                  {cat.name}
                </Text>
                {cat.listingCount != null ? (
                  <Text style={{ color: t.faint, fontSize: 12 }}>
                    {formatNumber(cat.listingCount, 0)} listing{cat.listingCount === 1 ? '' : 's'}
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
        <View style={[styles.ctaIcon, { backgroundColor: t.brandSoft }]}>
          <Store size={20} color={t.brandSoftFg} />
        </View>
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
    minHeight: 44,
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  gridItem: { width: '47.5%' },
  cta: { gap: 4, marginTop: 8 },
  ctaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  ctaTitle: { fontSize: 18, fontWeight: '800' },
});
