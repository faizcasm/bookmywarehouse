/** Listing detail — gallery, specs, amenities, availability strip, booking CTA. */

import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { BadgeCheck, Star, MapPin } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Button, Card, ErrorState, LoadingOverlay } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getListing, getListingAvailability } from '@/services/api/catalog';
import { formatMoney, formatDayLabel, humanize } from '@/utils/format';

export default function ListingDetailScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const listing = useQuery({
    queryKey: ['listing', slug],
    queryFn: () => getListing(slug!),
    enabled: !!slug,
  });

  const availability = useQuery({
    queryKey: ['availability', slug],
    queryFn: () => getListingAvailability(slug!, { days: 14 }),
    enabled: !!slug,
  });

  const [active, setActive] = useState(0);

  if (listing.isLoading) return <LoadingOverlay />;
  if (listing.isError) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <ErrorState error={listing.error} onRetry={() => listing.refetch()} />
      </View>
    );
  }

  const l = listing.data!;
  const gallery = l.gallery?.length ? l.gallery : l.coverUrl ? [l.coverUrl] : [];

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        {gallery.length ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setActive(Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width))
              }
            >
              {gallery.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.galleryImg} contentFit="cover" transition={200} />
              ))}
            </ScrollView>
            {gallery.length > 1 ? (
              <View style={styles.dots}>
                {gallery.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: i === active ? t.brand : t.surface3, opacity: i === active ? 1 : 0.6 },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.galleryImg, styles.galleryFallback, { backgroundColor: t.surface3 }]}>
            <Text style={{ color: t.faint }}>No images</Text>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: t.fgStrong }]}>{l.title}</Text>
            {l.verified ? <BadgeCheck size={20} color={t.brand} /> : null}
          </View>
          <View style={styles.metaRow}>
            <Badge label={humanize(l.type)} tone="accent" />
            {l.ratingAvg ? (
              <View style={styles.rating}>
                <Star size={16} color={t.warning} fill={t.warning} />
                <Text style={{ color: t.fg, fontWeight: '600' }}>{l.ratingAvg.toFixed(1)}</Text>
                {l.ratingCount != null ? <Text style={{ color: t.muted }}>({l.ratingCount})</Text> : null}
              </View>
            ) : null}
          </View>
          <View style={styles.locRow}>
            <MapPin size={16} color={t.muted} />
            <Text style={{ color: t.muted }}>
              {[l.addressLine, l.city, l.state].filter(Boolean).join(', ')}
            </Text>
          </View>

          {l.description ? <Text style={[styles.desc, { color: t.fg }]}>{l.description}</Text> : null}

          {l.specifications && Object.keys(l.specifications).length ? (
            <Card>
              <Text style={[styles.cardTitle, { color: t.fgStrong }]}>Specifications</Text>
              <View style={styles.specGrid}>
                {Object.entries(l.specifications).map(([k, v]) => (
                  <View key={k} style={styles.specItem}>
                    <Text style={{ color: t.muted, fontSize: 13 }}>{humanize(k)}</Text>
                    <Text style={{ color: t.fgStrong, fontWeight: '600' }}>{String(v)}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {l.amenities?.length ? (
            <Card>
              <Text style={[styles.cardTitle, { color: t.fgStrong }]}>Amenities</Text>
              <View style={styles.specGrid}>
                {l.amenities.map((a) => (
                  <View key={a} style={[styles.amenityChip, { backgroundColor: t.surface3 }]}>
                    <Text style={{ color: t.fg, fontSize: 13 }}>{a}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {availability.data?.length ? (
            <Card>
              <Text style={[styles.cardTitle, { color: t.fgStrong }]}>Availability</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {availability.data.map((slot) => (
                  <View
                    key={slot.date}
                    style={[styles.slot, { backgroundColor: slot.available ? t.successSoft : t.neutralSoft, borderColor: slot.available ? t.success : t.line }]}
                  >
                    <Text style={{ color: slot.available ? t.successSoftFg : t.neutralSoftFg, fontSize: 12, fontWeight: '600' }}>
                      {formatDayLabel(slot.date)}
                    </Text>
                    <Text style={{ color: slot.available ? t.successSoftFg : t.neutralSoftFg, fontSize: 11 }}>
                      {slot.available ? 'Open' : 'Booked'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Card>
          ) : null}

          {l.partnerName ? (
            <Text style={{ color: t.muted }}>Listed by {l.partnerName}</Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: t.surface, borderColor: t.line, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.price, { color: t.fgStrong }]}>
            {formatMoney(l.priceMinor, l.currency)}
            <Text style={{ color: t.muted, fontWeight: '400' }}> /{l.pricingPeriod?.toLowerCase()}</Text>
          </Text>
        </View>
        <Button
          label="Check availability & book"
          onPress={() => router.push(`/(customer)/listing/${l.slug}/book`)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  galleryImg: { width: 400, height: 280 },
  galleryFallback: { alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  body: { padding: 16, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '800', flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  desc: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  specItem: { minWidth: '45%', gap: 2 },
  amenityChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  slot: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 64 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  price: { fontSize: 18, fontWeight: '800' },
});