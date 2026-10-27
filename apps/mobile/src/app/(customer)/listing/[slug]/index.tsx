/** Listing detail — gallery, partner card, structured sections, reviews, similar listings. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { BadgeCheck, Check, ChevronLeft, Clock, Heart, MapPin, ShieldCheck } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListingCard } from '@/components/ListingCard';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  ErrorState,
  KeyValue,
  LoadingOverlay,
  SectionHeader,
  Skeleton,
  StarRating,
} from '@/components/ui';
import { toggleFavorite } from '@/services/api/account';
import { getListing, getListingAvailability, getListingReviews, getSimilarListings } from '@/services/api/catalog';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import type { ListingDetail } from '@/types';
import {
  formatDayLabel,
  formatDate,
  formatDaysOfWeek,
  formatMoney,
  formatPercent,
  formatRelativeTime,
  humanize,
} from '@/utils/format';

const REVIEWS_LIMIT = 5;
const SIMILAR_CARD_WIDTH = 220;

export default function ListingDetailScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useSession();

  const listing = useQuery({
    queryKey: ['listing', slug],
    queryFn: () => getListing(slug!),
    enabled: !!slug,
  });

  // ⚠ The availability endpoint resolves rules by listing OBJECT ID — a slug
  // makes the backend throw a CastError, so this only runs once the id exists.
  const listingId = listing.data?.id;
  const embeddedRelated = listing.data?.related ?? [];

  const availability = useQuery({
    queryKey: ['availability', listingId],
    queryFn: () => getListingAvailability(listingId!, { days: 14 }),
    enabled: !!listingId,
  });

  const reviews = useQuery({
    queryKey: ['listing-reviews', listingId],
    queryFn: () => getListingReviews(listingId!, { limit: REVIEWS_LIMIT }),
    enabled: !!listingId,
  });

  // The detail payload embeds related listings; only hit /similar as a fallback.
  const similarFallback = useQuery({
    queryKey: ['similar-listings', slug],
    queryFn: () => getSimilarListings(slug!),
    enabled: !!slug && !!listingId && embeddedRelated.length === 0,
  });

  const favorite = useMutation({
    mutationFn: (id: string) => toggleFavorite(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['listing', slug] });
      const previous = qc.getQueryData<ListingDetail>(['listing', slug]);
      qc.setQueryData<ListingDetail>(['listing', slug], (prev) =>
        prev ? { ...prev, isFavorite: !prev.isFavorite } : prev,
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData<ListingDetail>(['listing', slug], ctx.previous);
    },
    onSuccess: (result) => {
      if (typeof result?.favorited === 'boolean') {
        qc.setQueryData<ListingDetail>(['listing', slug], (prev) =>
          prev ? { ...prev, isFavorite: result.favorited } : prev,
        );
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['favorites'] });
      qc.invalidateQueries({ queryKey: ['listing', slug] });
    },
  });

  const [active, setActive] = useState(0);
  // Reset the gallery page when the [slug] param changes on this route instance.
  const [seenSlug, setSeenSlug] = useState(slug);
  if (seenSlug !== slug) {
    setSeenSlug(slug);
    setActive(0);
  }

  const onFavoritePress = () => {
    if (!listingId || favorite.isPending) return;
    if (!user) {
      router.push({ pathname: '/(auth)/login', params: { next: `/(customer)/listing/${slug}` } });
      return;
    }
    favorite.mutate(listingId);
  };

  if (listing.isLoading) return <LoadingOverlay />;
  if (listing.isError || !listing.data) {
    return (
      <View style={styles.flex}>
        <ErrorState error={listing.error} onRetry={() => listing.refetch()} />
      </View>
    );
  }

  const l = listing.data;
  const gallery = l.gallery?.length ? l.gallery : l.coverUrl ? [l.coverUrl] : [];
  const isFavorite = l.isFavorite ?? false;
  const canBook = l.canRequestBooking !== false;
  const partner = l.partner;
  const partnerName = partner?.businessName ?? l.partnerName;
  const similar = embeddedRelated.length ? embeddedRelated : (similarFallback.data ?? []);
  const blockedCount = (l.blockedDates ?? []).filter((b) => !b.isAvailable).length;
  const publishedReviews = (reviews.data?.items ?? []).filter(
    (r) => r.status !== 'HIDDEN' && r.status !== 'REMOVED',
  );

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 104 }}>
        {gallery.length ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setActive(
                  Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width),
                )
              }
            >
              {gallery.map((uri, i) => (
                <Image
                  key={`${i}-${uri}`}
                  source={{ uri }}
                  style={{ width, height: 300 }}
                  contentFit="cover"
                  transition={220}
                />
              ))}
            </ScrollView>
            {gallery.length > 1 ? (
              <View style={styles.dots}>
                {gallery.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: i === active ? t.brand : t.surface3,
                        opacity: i === active ? 1 : 0.6,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.galleryFallback, { width, backgroundColor: t.surface3 }]}>
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
            {l.categoryName ? <Badge label={l.categoryName} tone="neutral" /> : null}
            {l.ratingAvg ? (
              <StarRating rating={l.ratingAvg} count={l.ratingCount} showValue />
            ) : null}
          </View>
          <View style={styles.locRow}>
            <MapPin size={16} color={t.muted} />
            <Text style={[styles.locText, { color: t.muted }]}>
              {[l.addressLine, l.city, l.state].filter(Boolean).join(', ')}
            </Text>
          </View>

          {!canBook ? (
            <Banner
              tone="warn"
              title="Bookings paused"
              message={
                l.availableFrom
                  ? `This listing isn't taking new requests right now. It reopens on ${formatDate(l.availableFrom)}.`
                  : "This listing isn't taking new booking requests right now. You can still message the partner with questions."
              }
            />
          ) : null}

          {/* Partner */}
          {partnerName ? (
            <Card>
              <View style={styles.partnerRow}>
                <Avatar uri={partner?.logoUrl} name={partnerName} size={48} />
                <View style={styles.partnerInfo}>
                  <View style={styles.partnerNameRow}>
                    <Text style={[styles.partnerName, { color: t.fgStrong }]} numberOfLines={1}>
                      {partnerName}
                    </Text>
                    {partner?.verified ? <Badge label="Verified" tone="success" /> : null}
                  </View>
                  <View style={styles.partnerMeta}>
                    {partner?.rating ? (
                      <StarRating rating={partner.rating} showValue size={14} />
                    ) : null}
                    {partner?.responseRate != null ? (
                      <Text style={{ color: t.muted, fontSize: 12.5 }}>
                        Responds to {formatPercent(partner.responseRate)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
              <Button
                label="Message partner"
                variant="secondary"
                fullWidth
                style={styles.partnerButton}
                onPress={() => {
                  if (!user) {
                    router.push({
                      pathname: '/(auth)/login',
                      params: { next: `/(customer)/contact/${l.id}` },
                    });
                    return;
                  }
                  router.push(`/(customer)/contact/${l.id}` as never);
                }}
              />
            </Card>
          ) : null}

          {/* Description */}
          {l.description ? (
            <>
              <SectionHeader title="About this space" />
              <Card>
                <Text style={[styles.paragraph, { color: t.fg }]}>{l.description}</Text>
              </Card>
            </>
          ) : null}

          {/* Specifications */}
          {l.specifications && Object.keys(l.specifications).length ? (
            <>
              <SectionHeader title="Specifications" />
              <Card>
                <KeyValue
                  items={Object.entries(l.specifications).map(([key, value]) => ({
                    label: humanize(key),
                    value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value),
                  }))}
                />
              </Card>
            </>
          ) : null}

          {/* Amenities */}
          {l.amenities?.length ? (
            <>
              <SectionHeader title="Amenities" />
              <Card>
                <View style={styles.checkGrid}>
                  {l.amenities.map((amenity) => (
                    <View key={amenity} style={styles.checkRow}>
                      <Check size={15} color={t.brand} />
                      <Text style={[styles.checkText, { color: t.fg }]} numberOfLines={1}>
                        {amenity}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}

          {/* Safety features */}
          {l.safetyFeatures?.length ? (
            <>
              <SectionHeader title="Safety features" />
              <Card>
                <View style={styles.checkGrid}>
                  {l.safetyFeatures.map((feature) => (
                    <View key={feature} style={styles.checkRow}>
                      <ShieldCheck size={15} color={t.success} />
                      <Text style={[styles.checkText, { color: t.fg }]} numberOfLines={2}>
                        {feature}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}

          {/* House rules */}
          {l.rules?.length ? (
            <>
              <SectionHeader title="House rules" />
              <Card>
                <View style={styles.ruleList}>
                  {l.rules.map((rule, i) => (
                    <View key={rule} style={styles.ruleRow}>
                      <Text style={[styles.ruleIndex, { color: t.brand }]}>{i + 1}.</Text>
                      <Text style={[styles.paragraph, { color: t.fg, flex: 1 }]}>{rule}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}

          {/* Cancellation policy */}
          {l.cancellationTerms ? (
            <>
              <SectionHeader title="Cancellation policy" />
              <Card>
                <View style={styles.policyHead}>
                  <Badge
                    label={humanize(l.cancellationTerms.policy) || 'Standard'}
                    tone={
                      l.cancellationTerms.customerRefundPercent === 0
                        ? 'danger'
                        : (l.cancellationTerms.customerRefundPercent ?? 0) >= 50
                          ? 'success'
                          : 'warn'
                    }
                  />
                </View>
                <KeyValue
                  items={[
                    {
                      label: 'Refund if you cancel',
                      value: `${l.cancellationTerms.customerRefundPercent ?? 0}% of the booking total`,
                    },
                  ]}
                />
                {l.cancellationTerms.description ? (
                  <Text style={[styles.paragraph, { color: t.fg }]}>
                    {l.cancellationTerms.description}
                  </Text>
                ) : null}
                {l.cancellationTerms.note ? (
                  <Text style={[styles.smallNote, { color: t.muted }]}>
                    {l.cancellationTerms.note}
                  </Text>
                ) : null}
              </Card>
            </>
          ) : null}

          {/* Availability */}
          <SectionHeader title="Availability" />
          <Card>
            {l.minBookingDuration ? (
              <View style={styles.minBookRow}>
                <Clock size={16} color={t.muted} />
                <Text style={{ color: t.fg }}>
                  Minimum booking:{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {l.minBookingDuration.value}{' '}
                    {l.minBookingDuration.unit.toLowerCase()}
                    {l.minBookingDuration.value > 1 ? 's' : ''}
                  </Text>
                </Text>
              </View>
            ) : null}

            {l.availabilityRules?.length ? (
              <View style={styles.ruleList}>
                {l.availabilityRules.map((rule) => (
                  <Text key={rule.id} style={{ color: t.fg, fontSize: 14 }}>
                    • {formatDaysOfWeek(rule.daysOfWeek)}, {rule.startTime}–{rule.endTime}
                    {rule.startDate && rule.endDate
                      ? ` (${formatDate(rule.startDate)} – ${formatDate(rule.endDate)})`
                      : ''}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={{ color: t.muted, fontSize: 14 }}>Available every day</Text>
            )}

            <Text style={{ color: t.faint, fontSize: 13 }}>
              {blockedCount > 0
                ? `${blockedCount} blocked date${blockedCount > 1 ? 's' : ''} on the calendar`
                : 'No blocked dates on the calendar'}
            </Text>

            {availability.isLoading ? (
              <Skeleton height={64} radius={12} />
            ) : availability.isError ? (
              <Banner
                tone="danger"
                message="Couldn't load the day-by-day calendar."
                actionLabel="Try again"
                onAction={() => availability.refetch()}
              />
            ) : availability.data?.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.slotRow}
              >
                {availability.data.map((slot) => (
                  <View
                    key={slot.date}
                    style={[
                      styles.slot,
                      {
                        backgroundColor: slot.available ? t.successSoft : t.neutralSoft,
                        borderColor: slot.available ? t.success : t.line,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: slot.available ? t.successSoftFg : t.neutralSoftFg,
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      {formatDayLabel(slot.date)}
                    </Text>
                    <Text style={{ color: slot.available ? t.successSoftFg : t.neutralSoftFg, fontSize: 11 }}>
                      {slot.available ? 'Open' : 'Booked'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Card>

          {/* Reviews */}
          <SectionHeader title="Reviews" />
          <Card>
            {reviews.isLoading ? (
              <View style={styles.reviewList}>
                {[0, 1].map((i) => (
                  <Skeleton key={i} height={72} radius={12} />
                ))}
              </View>
            ) : reviews.isError ? (
              <Banner
                tone="danger"
                message="Couldn't load reviews."
                actionLabel="Try again"
                onAction={() => reviews.refetch()}
              />
            ) : publishedReviews.length ? (
              <>
                <View style={styles.reviewSummary}>
                  <StarRating
                    rating={reviews.data?.average ?? 0}
                    size={20}
                    showValue
                    count={reviews.data?.meta?.pagination?.totalItems ?? publishedReviews.length}
                  />
                </View>
                <View style={styles.reviewList}>
                  {publishedReviews.map((review) => (
                    <View key={review.id} style={styles.reviewItem}>
                      <View style={styles.reviewHead}>
                        <Text style={[styles.reviewAuthor, { color: t.fgStrong }]}>
                          {review.authorName ?? 'Guest'}
                        </Text>
                        <Text style={{ color: t.faint, fontSize: 12 }}>
                          {formatRelativeTime(review.createdAt)}
                        </Text>
                      </View>
                      <StarRating rating={review.rating} size={14} />
                      {review.comment ? (
                        <Text style={[styles.paragraph, { color: t.fg, fontSize: 14 }]}>
                          {review.comment}
                        </Text>
                      ) : null}
                      {review.response ? (
                        <View style={[styles.reviewResponse, { backgroundColor: t.surface2, borderColor: t.line }]}>
                          <Text style={[styles.reviewResponseLabel, { color: t.muted }]}>
                            {partnerName ?? 'Partner'} replied
                          </Text>
                          <Text style={{ color: t.fg, fontSize: 13.5, lineHeight: 19 }}>
                            {review.response}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={{ color: t.muted, fontSize: 14 }}>
                No reviews yet — be the first to book and share your experience.
              </Text>
            )}
          </Card>

          {/* Similar listings */}
          {similar.length ? (
            <>
              <SectionHeader title="Similar listings" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarRow}
              >
                {similar.map((item) => (
                  <View key={item.id} style={{ width: SIMILAR_CARD_WIDTH }}>
                    <ListingCard
                      listing={item}
                      variant="compact"
                      onPress={() => router.push(`/(customer)/listing/${item.slug}`)}
                    />
                  </View>
                ))}
              </ScrollView>
            </>
          ) : similarFallback.isLoading ? (
            <>
              <SectionHeader title="Similar listings" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
                {[0, 1].map((i) => (
                  <Skeleton key={i} width={SIMILAR_CARD_WIDTH} height={190} radius={16} />
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Floating gallery buttons — outside the ScrollView so they stay pinned */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.floatBtn, { backgroundColor: t.surface, right: 64, top: insets.top + 8 }]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ChevronLeft size={22} color={t.fg} />
      </Pressable>
      <Pressable
        onPress={onFavoritePress}
        style={[styles.floatBtn, { backgroundColor: t.surface, right: 16, top: insets.top + 8 }]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: isFavorite, busy: favorite.isPending }}
        accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Heart
          size={20}
          color={isFavorite ? t.danger : t.fg}
          fill={isFavorite ? t.danger : 'transparent'}
        />
      </Pressable>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: t.surface,
            borderColor: t.line,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.price, { color: t.fgStrong }]}>
            {formatMoney(l.priceMinor, l.currency)}
            <Text style={{ color: t.muted, fontWeight: '400' }}> /{l.pricingPeriod?.toLowerCase()}</Text>
          </Text>
          {!canBook ? <Text style={{ color: t.faint, fontSize: 12 }}>Bookings paused</Text> : null}
        </View>
        <Button
          label="Check availability & book"
          disabled={!canBook}
          onPress={() => router.push(`/(customer)/listing/${l.slug}/book`)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  galleryFallback: { height: 300, alignItems: 'center', justifyContent: 'center' },
  floatBtn: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  body: { padding: 16, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '800', flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locText: { flex: 1 },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  partnerInfo: { flex: 1, gap: 4 },
  partnerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  partnerName: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  partnerMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  partnerButton: { marginTop: 12 },
  paragraph: { fontSize: 15, lineHeight: 22 },
  smallNote: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, rowGap: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: '45%', flexGrow: 1 },
  checkText: { fontSize: 14, flexShrink: 1 },
  ruleList: { gap: 8 },
  ruleRow: { flexDirection: 'row', gap: 8 },
  ruleIndex: { fontWeight: '700', fontSize: 14 },
  policyHead: { marginBottom: 4 },
  minBookRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotRow: { gap: 8, paddingTop: 4 },
  slot: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 64,
  },
  reviewSummary: { marginBottom: 12 },
  reviewList: { gap: 14 },
  reviewItem: { gap: 6 },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  reviewAuthor: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  reviewResponse: {
    borderWidth: 1,
    borderRadius: 12,
    borderLeftWidth: 3,
    padding: 10,
    gap: 4,
    marginTop: 2,
  },
  reviewResponseLabel: { fontSize: 12, fontWeight: '700' },
  similarRow: { gap: 12, paddingVertical: 2 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  price: { fontSize: 18, fontWeight: '800' },
});
