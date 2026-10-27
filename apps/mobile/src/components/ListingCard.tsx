/** Listing card — cover image, title, city, price, rating, verified pill.
 *
 * Two layouts:
 *  - `variant="wide"`   full-width card used by single-column lists (search results).
 *  - `variant="compact"` half-width card used by the 2-up home grid; a shorter
 *    aspect-ratio cover and tighter type keep the grid scannable.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Star, BadgeCheck, MapPin, Heart } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import React, { useEffect, useState } from 'react';

import { Card } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { toggleFavorite } from '@/services/api/account';
import { formatMoney } from '@/utils/format';
import type { ListingSummary } from '@/types';

export interface ListingCardProps {
  listing: ListingSummary;
  onPress?: () => void;
  variant?: 'wide' | 'compact';
  /** Hide quick-save in the saved-list screen, which has its own remove action. */
  showFavorite?: boolean;
}

function ListingFavorite({ listing }: { listing: ListingSummary }) {
  const t = useTheme();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [isFavorite, setIsFavorite] = useState(Boolean(listing.isFavorite));

  useEffect(() => {
    setIsFavorite(Boolean(listing.isFavorite));
  }, [listing.id, listing.isFavorite]);

  const mutation = useMutation({
    mutationFn: () => toggleFavorite(listing.id),
    onMutate: () => {
      const previous = isFavorite;
      setIsFavorite(!previous);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) setIsFavorite(context.previous);
    },
    onSuccess: (result) => {
      if (typeof result.favorited === 'boolean') setIsFavorite(result.favorited);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['favorites'] }),
        queryClient.invalidateQueries({ queryKey: ['search'] }),
      ]);
    },
  });

  if (user && user.role !== 'CUSTOMER') return null;

  const onPress = () => {
    if (!user) {
      router.push({
        pathname: '/(auth)/login',
        params: { next: `/(customer)/listing/${listing.slug}` },
      });
      return;
    }
    if (!mutation.isPending) mutation.mutate();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={mutation.isPending}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? `Remove ${listing.title} from favorites` : `Save ${listing.title} to favorites`}
      accessibilityState={{ selected: isFavorite, disabled: mutation.isPending }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.favoriteButton,
        pressed && { transform: [{ scale: 0.92 }], opacity: 0.9 },
        mutation.isPending && { opacity: 0.6 },
      ]}
    >
      <Heart
        size={19}
        color={isFavorite ? t.danger : '#475569'}
        fill={isFavorite ? t.danger : 'transparent'}
        strokeWidth={2.2}
      />
    </Pressable>
  );
}

export function ListingCard({
  listing,
  onPress,
  variant = 'wide',
  showFavorite = true,
}: ListingCardProps) {
  const t = useTheme();
  const compact = variant === 'compact';

  return (
    <Card onPress={onPress} padded={false} style={styles.card}>
      <View style={styles.media}>
        {listing.coverUrl ? (
          <Image
            source={{ uri: listing.coverUrl }}
            style={[styles.cover, compact && styles.coverCompact]}
            contentFit="cover"
            transition={220}
          />
        ) : (
          <View
            style={[styles.cover, compact && styles.coverCompact, styles.coverFallback, { backgroundColor: t.surface3 }]}
          >
            <Text style={{ color: t.faint, fontSize: compact ? 12 : 14 }}>No image</Text>
          </View>
        )}

        {/* Verified pill rides on the image so it reads as a trust badge. */}
        {listing.verified ? (
          <View style={[styles.verifiedPill, { backgroundColor: t.brand }]}>
            <BadgeCheck size={12} color={t.brandFg} />
            <Text style={[styles.verifiedText, { color: t.brandFg }]}>Verified</Text>
          </View>
        ) : null}
        {showFavorite ? <ListingFavorite listing={listing} /> : null}
      </View>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text style={[styles.title, { color: t.fgStrong }, compact && styles.titleCompact]} numberOfLines={1}>
          {listing.title}
        </Text>

        <View style={styles.locationRow}>
          <MapPin size={compact ? 11 : 12} color={t.faint} />
          <Text style={[styles.city, { color: t.muted }]} numberOfLines={1}>
            {listing.city}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.price, { color: t.fgStrong }, compact && styles.priceCompact]} numberOfLines={1}>
            {formatMoney(listing.priceMinor, listing.currency)}
            <Text style={{ color: t.muted, fontWeight: '400' }}>
              /{listing.pricingPeriod?.toLowerCase()}
            </Text>
          </Text>
          {listing.ratingAvg ? (
            <View style={styles.rating}>
              <Star size={13} color={t.warning} fill={t.warning} />
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
  media: { position: 'relative' },
  favoriteButton: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  cover: { width: '100%', height: 160 },
  coverCompact: { height: 110 },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  verifiedPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifiedText: { fontSize: 11, fontWeight: '700' },
  body: { padding: 12, gap: 4 },
  bodyCompact: { padding: 10, gap: 3 },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 21 },
  titleCompact: { fontSize: 14, lineHeight: 18 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  city: { fontSize: 13, flexShrink: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  price: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  priceCompact: { fontSize: 14 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '600' },
});
