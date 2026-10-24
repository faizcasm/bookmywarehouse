/** Listing card — cover image, title, city, price, rating, verified pill. */

import { Image } from 'expo-image';
import { Star, BadgeCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { Card } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { formatMoney } from '@/utils/format';
import type { ListingSummary } from '@/types';

export interface ListingCardProps {
  listing: ListingSummary;
  onPress?: () => void;
}

export function ListingCard({ listing, onPress }: ListingCardProps) {
  const t = useTheme();
  return (
    <Card onPress={onPress} padded={false} style={styles.card}>
      {listing.coverUrl ? (
        <Image source={{ uri: listing.coverUrl }} style={styles.cover} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.cover, styles.coverFallback, { backgroundColor: t.surface3 }]}>
          <Text style={{ color: t.faint }}>No image</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={1}>
            {listing.title}
          </Text>
          {listing.verified ? <BadgeCheck size={16} color={t.brand} /> : null}
        </View>
        <Text style={[styles.city, { color: t.muted }]} numberOfLines={1}>
          {listing.city}
        </Text>
        <View style={styles.footer}>
          <Text style={[styles.price, { color: t.fgStrong }]}>
            {formatMoney(listing.priceMinor, listing.currency)}
            <Text style={{ color: t.muted, fontWeight: '400' }}> /{listing.pricingPeriod?.toLowerCase()}</Text>
          </Text>
          {listing.ratingAvg ? (
            <View style={styles.rating}>
              <Star size={14} color={t.warning} fill={t.warning} />
              <Text style={[styles.ratingText, { color: t.muted }]}>{listing.ratingAvg.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  cover: { width: '100%', height: 160 },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 12, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  city: { fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  price: { fontSize: 15, fontWeight: '700' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '600' },
});