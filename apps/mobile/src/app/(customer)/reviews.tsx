/**
 * Reviews — reviews the customer has written, plus the write-a-review flow
 * (pick a completed booking → rate → submit).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  Screen,
  Sheet,
  SignInPrompt,
  Skeleton,
  StarRating,
  TextField,
} from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { listMyReviews, createReview } from '@/services/api/account';
import { listBookings } from '@/services/api/bookings';
import { formatDate, formatDayRange, humanize } from '@/utils/format';
import type { Review } from '@/types';

export default function ReviewsScreen() {
  const t = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Only fetched while the picker sheet is open.
  const completed = useQuery({
    queryKey: ['bookings', 'reviewable'],
    queryFn: () => listBookings({ status: 'COMPLETED', limit: 50 }),
    enabled: !!user && sheetOpen,
  });

  // Booking ids that already carry a review from this user — hidden from the picker.
  const reviewed = useQuery({
    queryKey: ['my-reviews', 'reviewed-booking-ids'],
    queryFn: () =>
      listMyReviews({ limit: 100 }).then((res) =>
        res.items.map((r) => r.bookingId).filter((id): id is string => Boolean(id)),
      ),
    enabled: !!user && sheetOpen,
  });

  const submit = useMutation({
    mutationFn: () =>
      createReview({ bookingId, rating, comment: comment.trim() || undefined }),
    onSuccess: () => {
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ['my-reviews'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (err) =>
      setFormError(err instanceof Error ? err.message : 'Could not submit the review.'),
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to see your reviews"
          subtitle="Your reviews of past bookings live here."
          next="/(customer)/reviews"
        />
      </Screen>
    );
  }

  const resetForm = () => {
    setBookingId('');
    setRating(0);
    setComment('');
    setFormError(null);
    setSuccess(false);
  };

  const openSheet = () => {
    resetForm();
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    resetForm();
  };

  const reviewedSet = new Set(reviewed.data ?? []);
  const reviewable = (completed.data?.items ?? []).filter((b) => !reviewedSet.has(b.id));

  return (
    <Screen style={styles.screen}>
      <PaginatedList<Review>
        queryKey={['my-reviews']}
        fetchPage={(page) => listMyReviews({ page })}
        keyExtractor={(r) => r.id}
        itemHeight={150}
        emptyTitle="No reviews yet"
        emptySubtitle="Reviews you write after a completed booking will appear here."
        header={
          <View style={styles.header}>
            <Text style={[styles.heading, { color: t.fgStrong }]}>Your reviews</Text>
            <Button label="Write a review" variant="secondary" onPress={openSheet} />
          </View>
        }
        renderItem={(review) => <ReviewCard review={review} />}
      />

      <Sheet
        visible={sheetOpen}
        onClose={closeSheet}
        title="Write a review"
        subtitle="Share how the space and partner worked out for you."
        dismissOnBackdrop={false}
        footer={
          success ? (
            <Button label="Done" onPress={closeSheet} fullWidth />
          ) : (
            <Button
              label="Submit review"
              onPress={() => submit.mutate()}
              loading={submit.isPending}
              disabled={!bookingId || rating < 1}
              fullWidth
            />
          )
        }
      >
        {success ? (
          <Banner
            tone="success"
            title="Review submitted"
            message="Thanks — your review is now visible on the listing."
          />
        ) : (
          <>
            {formError ? <Banner tone="danger" message={formError} /> : null}

            <Text style={[styles.sheetLabel, { color: t.fgStrong }]}>Booking</Text>
            {completed.isLoading || reviewed.isLoading ? (
              <Skeleton height={38} />
            ) : reviewable.length ? (
              <View style={styles.wrapRow}>
                {reviewable.map((b) => (
                  <Chip
                    key={b.id}
                    label={b.listingTitle ?? 'Booking'}
                    selected={bookingId === b.id}
                    size="sm"
                    onPress={() => setBookingId(b.id)}
                  />
                ))}
              </View>
            ) : (
              <Text style={{ color: t.muted, fontSize: 13, lineHeight: 19 }}>
                Every completed booking of yours has been reviewed already.
              </Text>
            )}
            {bookingId ? (
              <Text style={{ color: t.faint, fontSize: 12.5 }}>
                {formatDayRange(
                  reviewable.find((b) => b.id === bookingId)?.startDate,
                  reviewable.find((b) => b.id === bookingId)?.endDate,
                )}
              </Text>
            ) : null}

            <Text style={[styles.sheetLabel, { color: t.fgStrong }]}>Rating</Text>
            <View style={styles.ratingRow}>
              <StarRating rating={rating} onChange={setRating} size={30} />
              <Text style={{ color: t.muted, fontSize: 13 }}>
                {rating > 0 ? `${rating} of 5` : 'Tap the stars'}
              </Text>
            </View>

            <TextField
              label="Comment"
              value={comment}
              onChangeText={setComment}
              placeholder="What stood out? Cleanliness, access, responsiveness…"
              multiline
              hint="Optional, but it helps other businesses choose."
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const t = useTheme();
  const pending = review.status && review.status !== 'PUBLISHED';

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={[styles.listingTitle, { color: t.fgStrong }]} numberOfLines={1}>
          {review.listingTitle ?? 'Listing'}
        </Text>
        <Text style={[styles.date, { color: t.faint }]}>{formatDate(review.createdAt)}</Text>
      </View>
      <View style={styles.cardTop}>
        <StarRating rating={review.rating} size={15} />
        {pending ? (
          <Badge label={humanize(review.status ?? '') || 'Pending'} tone="warn" />
        ) : null}
      </View>
      {review.comment ? (
        <Text style={[styles.comment, { color: t.fg }]}>{review.comment}</Text>
      ) : null}
      {review.response ? (
        <View style={[styles.response, { backgroundColor: t.surface3 }]}>
          <Text style={[styles.responseLabel, { color: t.muted }]}>Partner reply</Text>
          <Text style={{ color: t.fg, fontSize: 13.5, lineHeight: 19 }}>{review.response}</Text>
          {review.responseAt ? (
            <Text style={{ color: t.faint, fontSize: 12 }}>{formatDate(review.responseAt)}</Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heading: { fontSize: 22, fontWeight: '800' },
  card: { gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  listingTitle: { fontSize: 15.5, fontWeight: '700', flexShrink: 1 },
  date: { fontSize: 12 },
  comment: { fontSize: 14, lineHeight: 20 },
  response: { marginTop: 6, padding: 10, borderRadius: 12, gap: 4 },
  responseLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  sheetLabel: { fontSize: 14, fontWeight: '700' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
