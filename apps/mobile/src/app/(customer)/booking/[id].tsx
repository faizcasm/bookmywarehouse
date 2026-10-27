/** Booking detail — status, summary, timeline, and customer actions. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  ErrorState,
  KeyValue,
  LoadingOverlay,
  Screen,
  SectionHeader,
  Sheet,
  SignInPrompt,
  StarRating,
  TextField,
} from '@/components/ui';
import { cancelBooking, getBooking } from '@/services/api/bookings';
import {
  createConversation,
  createReview,
  DISPUTE_REASONS,
  openDispute,
  type DisputeReason,
} from '@/services/api/account';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { BOOKING_STATUS_META, formatDayRange, formatDateTime, formatMoney, humanize } from '@/utils/format';

const CANCEL_REASONS = [
  'Schedule changed',
  'Found a closer space',
  'Booked by mistake',
  'Partner unavailable',
  'Other',
] as const;

const CANCEL_DETAIL_MIN = 3;
const DISPUTE_DESCRIPTION_MIN = 20;

const CANCELLABLE_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'AWAITING_PAYMENT', 'CONFIRMED'];
const DISPUTABLE_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'REFUND_PENDING'];

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function BookingDetailScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status: sessionStatus } = useSession();

  const booking = useQuery({
    queryKey: ['booking', id],
    queryFn: () => getBooking(id!),
    enabled: !!id && sessionStatus === 'authenticated',
  });
  const b = booking.data ?? null;

  const [sheet, setSheet] = useState<'cancel' | 'dispute' | 'review' | null>(null);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelDetail, setCancelDetail] = useState('');
  const [disputeReason, setDisputeReason] = useState<DisputeReason>('SERVICE_NOT_DELIVERED');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  // Success feedback lives inline (banners), never a native alert.
  const [refundMinor, setRefundMinor] = useState<number | null>(null);
  const [disputeReference, setDisputeReference] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['booking', id] });
    qc.invalidateQueries({ queryKey: ['bookings'] });
  };

  const cancel = useMutation({
    mutationFn: () =>
      cancelBooking(
        id!,
        [cancelReason, cancelDetail.trim()].filter(Boolean).join(' — '),
      ),
    onSuccess: (result) => {
      setSheet(null);
      setRefundMinor(result.refundAmountMinor);
      setCancelReason(null);
      setCancelDetail('');
      invalidate();
    },
  });

  const dispute = useMutation({
    mutationFn: () =>
      openDispute(id!, { reason: disputeReason, description: disputeDescription.trim() }),
    onSuccess: (result) => {
      setSheet(null);
      setDisputeReference(result.reference);
      setDisputeDescription('');
      invalidate();
    },
  });

  const review = useMutation({
    mutationFn: () =>
      createReview({
        bookingId: id!,
        rating: reviewRating,
        comment: reviewComment.trim() ? reviewComment.trim() : undefined,
      }),
    onSuccess: () => {
      setSheet(null);
      setReviewed(true);
      setReviewRating(0);
      setReviewComment('');
      qc.invalidateQueries({ queryKey: ['my-reviews'] });
      invalidate();
    },
  });

  const messagePartner = useMutation({
    mutationFn: () =>
      createConversation({
        listingId: b!.listingId,
        subject: `Booking ${b!.reference ?? b!.id}`,
        body: `Hi ${b!.partnerName ?? 'there'}, I have a question about booking ${
          b!.reference ?? b!.id
        } for ${b!.listingTitle ?? 'my booking'}.`,
      }),
    onSuccess: (result) => router.push(`/(customer)/conversation/${result.conversationId}`),
  });

  if (sessionStatus !== 'authenticated') {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to view this booking"
          subtitle="Your bookings, invoices and messages live on your account."
          next={`/(customer)/booking/${id}`}
        />
      </Screen>
    );
  }
  if (booking.isLoading) return <LoadingOverlay />;
  if (booking.isError || !b) {
    return (
      <Screen>
        <ErrorState error={booking.error} onRetry={() => booking.refetch()} />
      </Screen>
    );
  }

  const meta = BOOKING_STATUS_META[b.status];
  const canPay = b.status === 'AWAITING_PAYMENT';
  const canCancel = CANCELLABLE_STATUSES.includes(b.status);
  const canDispute = DISPUTABLE_STATUSES.includes(b.status);
  const canReview = b.status === 'COMPLETED';
  const showInvoice = b.status === 'COMPLETED';
  const isDisputed = b.status === 'DISPUTED';

  const timeline = b.timeline ?? [];

  const cancelDetailTrimmed = cancelDetail.trim();
  const cancelValid =
    cancelReason !== null &&
    (cancelDetailTrimmed.length === 0 || cancelDetailTrimmed.length >= CANCEL_DETAIL_MIN);
  const disputeDescriptionTrimmed = disputeDescription.trim();
  const disputeValid = disputeDescriptionTrimmed.length >= DISPUTE_DESCRIPTION_MIN;
  const reviewValid = reviewRating >= 1;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={2}>
          {b.listingTitle ?? 'Booking'}
        </Text>
        <Badge label={meta?.label ?? b.status} tone={meta?.tone ?? 'neutral'} />
      </View>
      {b.reference ? <Text style={{ color: t.faint, fontSize: 13 }}>Ref {b.reference}</Text> : null}

      {refundMinor !== null ? (
        <Banner
          tone="success"
          title="Booking cancelled"
          message={
            refundMinor > 0
              ? `A refund of ${formatMoney(refundMinor, b.currency)} has been queued and will reach your account within 5–7 working days.`
              : 'Your booking has been cancelled.'
          }
        />
      ) : null}
      {disputeReference ? (
        <Banner
          tone="success"
          title="Dispute opened"
          message={`Case reference ${disputeReference}. Our team will review it and update you by email.`}
        />
      ) : null}
      {reviewed ? (
        <Banner
          tone="success"
          title="Review submitted"
          message="Thanks for sharing your experience — it helps other customers."
        />
      ) : null}
      {isDisputed ? (
        <Banner tone="warn" title="Under dispute" message="This booking is being reviewed by our dispute team." />
      ) : null}

      <Card>
        <KeyValue
          items={[
            { label: 'Dates', value: formatDayRange(b.startDate, b.endDate) },
            { label: 'Space units', value: String(b.spaceUnits) },
            { label: 'Total', value: formatMoney(b.totalMinor, b.currency) },
            ...(b.partnerName ? [{ label: 'Partner', value: b.partnerName }] : []),
            ...(b.customerName ? [{ label: 'Customer', value: b.customerName }] : []),
            {
              label: 'Listing',
              value: b.listingTitle ?? '—',
              block: true,
            },
            { label: 'Created', value: formatDateTime(b.createdAt) },
          ]}
        />
      </Card>

      {timeline.length ? (
        <>
          <SectionHeader title="Timeline" />
          <Card>
            {timeline.map((ev, i) => {
              const evMeta = BOOKING_STATUS_META[ev.status as keyof typeof BOOKING_STATUS_META];
              const last = i === timeline.length - 1;
              return (
                <View key={`${ev.status}-${i}`} style={styles.timelineRow}>
                  <View style={styles.timelineMarker}>
                    <View style={[styles.dot, { backgroundColor: t.brand }]} />
                    {!last ? <View style={[styles.line, { backgroundColor: t.line }]} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
                    <Text style={{ color: t.fg, fontWeight: '600' }}>
                      {evMeta?.label ?? ev.status}
                    </Text>
                    <Text style={{ color: t.faint, fontSize: 12 }}>{formatDateTime(ev.at)}</Text>
                    {ev.note ? (
                      <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>{ev.note}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Actions" />
      <View style={styles.actions}>
        {canPay ? (
          <Button
            label="Pay now"
            fullWidth
            onPress={() => router.push(`/(customer)/pay/${b.id}` as never)}
          />
        ) : null}

        <Button
          label="Message partner"
          variant="secondary"
          fullWidth
          loading={messagePartner.isPending}
          onPress={() => messagePartner.mutate()}
        />
        {messagePartner.isError ? (
          <Banner tone="danger" message={messageFor(messagePartner.error)} />
        ) : null}

        {showInvoice ? (
          <Button
            label="View invoice"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/(customer)/invoices')}
          />
        ) : null}

        {canReview ? (
          <Button
            label="Leave a review"
            variant="secondary"
            fullWidth
            onPress={() => setSheet('review')}
          />
        ) : null}

        {canCancel ? (
          <Button label="Cancel booking" variant="danger" fullWidth onPress={() => setSheet('cancel')} />
        ) : null}

        {canDispute ? (
          <Button
            label="Open a dispute"
            variant="secondary"
            fullWidth
            onPress={() => setSheet('dispute')}
          />
        ) : null}
      </View>

      {/* Cancel sheet */}
      <Sheet
        visible={sheet === 'cancel'}
        onClose={() => setSheet(null)}
        title="Cancel booking"
        subtitle="The partner will be notified immediately."
        dismissOnBackdrop={false}
        footer={
          <Button
            label="Cancel booking"
            variant="danger"
            fullWidth
            disabled={!cancelValid}
            loading={cancel.isPending}
            onPress={() => cancel.mutate()}
          />
        }
      >
        <Text style={[styles.sheetLabel, { color: t.fg }]}>Reason</Text>
        <View style={styles.chips}>
          {CANCEL_REASONS.map((reason) => (
            <Chip
              key={reason}
              label={reason}
              selected={cancelReason === reason}
              onPress={() => setCancelReason(reason)}
            />
          ))}
        </View>
        <TextField
          label="Details (optional)"
          value={cancelDetail}
          onChangeText={setCancelDetail}
          placeholder="Anything the partner should know…"
          multiline
          error={
            cancelDetailTrimmed.length > 0 && cancelDetailTrimmed.length < CANCEL_DETAIL_MIN
              ? `Add at least ${CANCEL_DETAIL_MIN} characters or clear this field.`
              : undefined
          }
          hint={`${cancelDetail.length} characters`}
        />
        {cancel.isError ? <Banner tone="danger" message={messageFor(cancel.error)} /> : null}
      </Sheet>

      {/* Dispute sheet */}
      <Sheet
        visible={sheet === 'dispute'}
        onClose={() => setSheet(null)}
        title="Open a dispute"
        subtitle="Tell us what went wrong — our team reviews every case."
        dismissOnBackdrop={false}
        footer={
          <Button
            label="Open dispute"
            fullWidth
            disabled={!disputeValid}
            loading={dispute.isPending}
            onPress={() => dispute.mutate()}
          />
        }
      >
        <Text style={[styles.sheetLabel, { color: t.fg }]}>Reason</Text>
        <View style={styles.chips}>
          {DISPUTE_REASONS.map((reason) => (
            <Chip
              key={reason}
              label={humanize(reason)}
              selected={disputeReason === reason}
              onPress={() => setDisputeReason(reason)}
            />
          ))}
        </View>
        <TextField
          label="What happened?"
          value={disputeDescription}
          onChangeText={setDisputeDescription}
          placeholder="Describe the issue in as much detail as you can…"
          multiline
          numberOfLines={5}
          error={
            disputeDescriptionTrimmed.length > 0 &&
            disputeDescriptionTrimmed.length < DISPUTE_DESCRIPTION_MIN
              ? `Please write at least ${DISPUTE_DESCRIPTION_MIN} characters.`
              : undefined
          }
          hint={`${disputeDescription.length} characters (min ${DISPUTE_DESCRIPTION_MIN})`}
        />
        {dispute.isError ? <Banner tone="danger" message={messageFor(dispute.error)} /> : null}
      </Sheet>

      {/* Review sheet */}
      <Sheet
        visible={sheet === 'review'}
        onClose={() => setSheet(null)}
        title="Leave a review"
        subtitle="How was your booking experience?"
        footer={
          <Button
            label="Submit review"
            fullWidth
            disabled={!reviewValid}
            loading={review.isPending}
            onPress={() => review.mutate()}
          />
        }
      >
        <View style={styles.ratingWrap}>
          <StarRating rating={reviewRating} size={30} onChange={setReviewRating} />
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {reviewRating > 0 ? `${reviewRating} of 5 selected` : 'Tap the stars to rate'}
          </Text>
        </View>
        <TextField
          label="Comment (optional)"
          value={reviewComment}
          onChangeText={setReviewComment}
          placeholder="What stood out? Cleanliness, access, partner responsiveness…"
          multiline
          numberOfLines={4}
          hint={`${reviewComment.length} characters`}
        />
        {review.isError ? <Banner tone="danger" message={messageFor(review.error)} /> : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', flexShrink: 1 },
  actions: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetLabel: { fontSize: 14, fontWeight: '600' },
  ratingWrap: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineMarker: { alignItems: 'center', width: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  line: { width: 2, flex: 1, marginTop: 4 },
});
