/**
 * Home screen — platform banners, hero search, categories and featured listings.
 *
 * The announcement / maintenance banners come from the public platform
 * settings endpoint so ops can reach every user without an app release.
 */

import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowRight, Store, MapPin, Sparkles } from 'lucide-react-native';
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
import { getCategories, getPlatformSettings, searchListings, POPULAR_CITIES } from '@/services/api/catalog';
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
      <View
        style={[
          styles.hero,
          {
            backgroundColor: t.name === 'dark' ? 'rgba(24,24,24,0.70)' : 'rgba(255,255,255,0.68)',
            borderColor: t.name === 'dark' ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.92)',
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.heroOrb,
            { backgroundColor: t.name === 'dark' ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.08)' },
          ]}
        />
        <View style={[styles.heroEyebrow, { backgroundColor: t.brandSoft, borderColor: t.line }]}>
          <Sparkles size={13} color={t.brandSoftFg} />
          <Text style={{ color: t.brandSoftFg, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
            BOOKMYWAREHOUSE
          </Text>
        </View>
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
            {
              backgroundColor: t.name === 'dark' ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.76)',
              borderColor: pressed ? t.lineStrong : t.name === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.96)',
            },
            pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
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
                  {
                  backgroundColor: t.name === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.76)',
                  borderColor: pressed ? t.lineStrong : t.name === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.92)',
                },
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

      {/* Quick city entry points make logistics-market discovery one tap. */}
      <View>
        <SectionHeader title="Explore by city" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cityRow}
        >
          {POPULAR_CITIES.slice(0, 8).map((city) => (
            <Pressable
              key={city}
              onPress={() =>
                router.push({
                  pathname: '/(customer)/(tabs)/search',
                  params: { city },
                })
              }
              style={({ pressed }) => [
                styles.cityChip,
                {
                  backgroundColor: t.name === 'dark' ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.72)',
                  borderColor: pressed ? t.brand : t.line,
                },
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Explore warehouse and equipment listings in ${city}`}
            >
              <MapPin size={14} color={t.brand} />
              <Text style={{ color: t.fg, fontSize: 13, fontWeight: '700' }}>{city}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Featured — 2-up grid */ }
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
  hero: {
    position: 'relative',
    overflow: 'hidden',
    gap: 8,
    padding: 18,
    borderWidth: 1,
    borderRadius: 26,
    marginTop: 2,
    marginBottom: 4,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  heroOrb: {
    position: 'absolute',
    top: -46,
    right: -42,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  heroEyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 2,
  },
  heroTitle: { fontSize: 32, fontWeight: '900', lineHeight: 38, letterSpacing: -0.9 },
  heroSub: { fontSize: 15, lineHeight: 22, maxWidth: 340 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 58,
    marginTop: 10,
  },
  searchIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catRow: { gap: 10, paddingRight: 8 },
  cityRow: { gap: 8, paddingRight: 8 },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 10,
    minHeight: 42,
  },
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
