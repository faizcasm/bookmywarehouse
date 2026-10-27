/**
 * Partner booking detail — reference, customer, timeline and the lifecycle
 * actions (accept / decline / start / complete / cancel) driven by the
 * booking's `availableActions`, plus a shortcut into the customer thread.
 *
 * Destructive actions (decline, cancel) open a confirmation Sheet with an
 * optional reason instead of an Alert.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare } from 'lucide-react-native';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Banner,
  Button,
  Card,
  ErrorState,
  KeyValue,
  Screen,
  SectionHeader,
  Sheet,
  SignInPrompt,
  Skeleton,
  TextField,
} from '@/components/ui';
import { ApiError } from '@/services/api/client';
import {
  cancelPartnerBooking,
  completeBooking,
  confirmBooking,
  getPartnerBooking,
  rejectPartnerBooking,
  startBooking,
} from '@/services/api/partner';
import { listConversations } from '@/services/api/account';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import {
  BOOKING_STATUS_META,
  formatDateTime,
  formatDayRange,
  formatMoney,
  shortenId,
} from '@/utils/format';
import type { Booking } from '@/types';

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Try again.';

const actionsOf = (b: Booking) => b.availableActions ?? [];
const canAccept = (b: Booking) => actionsOf(b).some((a) => a === 'CONFIRMED' || a === 'AWAITING_PAYMENT');
const canReject = (b: Booking) => actionsOf(b).includes('REJECTED');
const canStart = (b: Booking) => actionsOf(b).includes('IN_PROGRESS');
const canComplete = (b: Booking) => actionsOf(b).includes('COMPLETED');
const canCancel = (b: Booking) => actionsOf(b).includes('CANCELLED');

type SheetMode = 'none' | 'reject' | 'complete' | 'cancel';

export default function PartnerBookingDetailScreen() {
  const t = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = id ?? '';

  const [mode, setMode] = useState<SheetMode>('none');
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [threadHint, setThreadHint] = useState<string | null>(null);

  const booking = useQuery({
    queryKey: ['partner-booking', bookingId],
    queryFn: () => getPartnerBooking(bookingId),
    enabled: Boolean(bookingId) && Boolean(user),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['partner-booking', bookingId] });
    qc.invalidateQueries({ queryKey: ['partner-bookings'] });
    qc.invalidateQueries({ queryKey: ['partner-dashboard'] });
  };

  const finish = (message: string) => {
    setMode('none');
    setNote('');
    setActionError(null);
    setNotice(message);
    invalidate();
  };

  const accept = useMutation({
    mutationFn: () => confirmBooking(bookingId),
    onSuccess: () => finish('Request accepted — the customer has been notified.'),
    onError: (e) => setActionError(errorText(e)),
  });
  const reject = useMutation({
    mutationFn: (reason: string) => rejectPartnerBooking(bookingId, reason),
    onSuccess: () => finish('Request declined — the customer has been notified.'),
    onError: (e) => setActionError(errorText(e)),
  });
  const start = useMutation({
    mutationFn: () => startBooking(bookingId),
    onSuccess: () => finish('Booking marked as started.'),
    onError: (e) => setActionError(errorText(e)),
  });
  const complete = useMutation({
    mutationFn: (noteText: string | undefined) => completeBooking(bookingId, noteText),
    onSuccess: () => finish('Booking completed — the customer can now review it.'),
    onError: (e) => setActionError(errorText(e)),
  });
  const cancel = useMutation({
    mutationFn: (reason: string) => cancelPartnerBooking(bookingId, reason),
    onSuccess: (result) => {
      finish(
        result.refundAmountMinor > 0
          ? `Booking cancelled — a ${formatMoney(result.refundAmountMinor, result.booking.currency)} refund was queued for the customer.`
          : 'Booking cancelled — the customer has been notified.',
      );
    },
    onError: (e) => setActionError(errorText(e)),
  });

  /**
   * The booking view-model has no customerId, and createConversation rejects a
   * partner-started thread without one — so we look for an existing thread
   * with this customer and otherwise point at Messages honestly.
   */
  const openThread = useMutation({
    mutationFn: () => listConversations({ page: 1 }),
    onSuccess: (result) => {
      const customer = booking.data?.customerName;
      const match = customer
        ? result.items.find((c) => c.counterpartyName.trim() === customer.trim())
        : undefined;
      if (match) {
        setThreadHint(null);
        router.push('/(partner)/(tabs)/messages' as never);
      } else {
        setThreadHint(
          customer
            ? `No thread with ${customer} yet — customers usually start it from their booking. It will appear in Messages as soon as they write.`
            : 'No conversation found for this booking yet. It will appear in Messages once the customer writes.',
        );
      }
    },
    onError: (e) => setThreadHint(errorText(e)),
  });

  const busy =
    accept.isPending ||
    reject.isPending ||
    start.isPending ||
    complete.isPending ||
    cancel.isPending ||
    openThread.isPending;

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to view this booking"
          subtitle="Booking details and actions are available from your partner account."
          next={`/(partner)/booking/${bookingId}`}
        />
      </Screen>
    );
  }

  if (booking.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={40} radius={12} />
        <Skeleton height={180} radius={t.radiusLg} />
        <Skeleton height={140} radius={t.radiusLg} />
        <Skeleton height={120} radius={t.radiusLg} />
      </Screen>
    );
  }

  if (booking.isError || !booking.data) {
    const notFound = booking.error instanceof ApiError && booking.error.status === 404;
    return (
      <Screen>
        <ErrorState
          title={notFound ? 'Booking not found' : undefined}
          error={booking.error}
          onRetry={notFound ? undefined : () => booking.refetch()}
        />
      </Screen>
    );
  }

  const b = booking.data;
  const meta = BOOKING_STATUS_META[b.status];
  const reference = b.reference ?? shortenId(b.id);

  const closeSheet = () => {
    if (busy) return;
    setMode('none');
    setNote('');
    setActionError(null);
  };

  return (
    <Screen scroll>
      <View style={styles.backBar}>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to bookings"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(partner)/(tabs)/bookings'))}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color={t.fg} />
          <Text style={[styles.backTitle, { color: t.fgStrong }]}>Booking {reference}</Text>
        </Pressable>
      </View>

      {notice ? (
        <Banner tone="success" message={notice} actionLabel="Dismiss" onAction={() => setNotice(null)} />
      ) : null}
      {actionError ? <Banner tone="danger" message={actionError} /> : null}
      {threadHint ? (
        <Banner
          tone="info"
          message={threadHint}
          actionLabel="Open messages"
          onAction={() => router.push('/(partner)/(tabs)/messages' as never)}
        />
      ) : null}

      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={2}>
          {b.listingTitle ?? 'Booking'}
        </Text>
        <Badge label={meta?.label ?? b.status} tone={meta?.tone ?? 'neutral'} />
      </View>

      {b.coverUrl ? (
        <Image
          source={{ uri: b.coverUrl }}
          style={[styles.cover, { backgroundColor: t.surface3 }]}
          contentFit="cover"
          transition={180}
          accessibilityLabel={b.listingTitle ?? 'Booking cover'}
        />
      ) : null}

      <Card>
        <KeyValue
          items={[
            { label: 'Customer', value: b.customerName ?? '—' },
            { label: 'Dates', value: formatDayRange(b.startDate, b.endDate) },
            { label: 'Units', value: b.spaceUnits },
            { label: 'Total', value: formatMoney(b.totalMinor, b.currency) },
            { label: 'Reference', value: reference },
            ...(b.createdAt ? [{ label: 'Created', value: formatDateTime(b.createdAt) }] : []),
          ]}
        />
      </Card>

      <Button
        label={openThread.isPending ? 'Opening messages…' : 'Message customer'}
        variant="secondary"
        fullWidth
        disabled={busy}
        loading={openThread.isPending}
        onPress={() => {
          setNotice(null);
          setThreadHint(null);
          openThread.mutate();
        }}
      />
      <View style={styles.messageIconRow}>
        <MessageSquare size={14} color={t.faint} />
        <Text style={{ color: t.faint, fontSize: 12 }}>
          Threads live in the Messages tab.
        </Text>
      </View>

      {b.timeline?.length ? (
        <Card>
          <SectionHeader title="Timeline" />
          {b.timeline.map((event, index) => (
            <View key={`${event.status}-${index}`} style={styles.timelineRow}>
              <View style={[styles.dot, { backgroundColor: t.brand }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.fg, fontWeight: '600' }}>
                  {BOOKING_STATUS_META[event.status as keyof typeof BOOKING_STATUS_META]?.label ??
                    event.status}
                </Text>
                {event.note ? (
                  <Text style={{ color: t.muted, fontSize: 12.5 }}>{event.note}</Text>
                ) : null}
                <Text style={{ color: t.faint, fontSize: 12 }}>{formatDateTime(event.at)}</Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <SectionHeader title="Actions" />
      {canAccept(b) ? (
        <Button
          label="Accept request"
          fullWidth
          loading={accept.isPending}
          disabled={busy}
          onPress={() => {
            setActionError(null);
            setNotice(null);
            accept.mutate();
          }}
        />
      ) : null}
      {canReject(b) ? (
        <Button
          label="Decline request"
          variant="secondary"
          fullWidth
          disabled={busy}
          onPress={() => {
            setActionError(null);
            setNotice(null);
            setNote('');
            setMode('reject');
          }}
        />
      ) : null}
      {canStart(b) ? (
        <Button
          label="Start booking"
          fullWidth
          loading={start.isPending}
          disabled={busy}
          onPress={() => {
            setActionError(null);
            setNotice(null);
            start.mutate();
          }}
        />
      ) : null}
      {canComplete(b) ? (
        <Button
          label="Mark as completed"
          fullWidth
          disabled={busy}
          onPress={() => {
            setActionError(null);
            setNotice(null);
            setNote('');
            setMode('complete');
          }}
        />
      ) : null}
      {canCancel(b) ? (
        <Button
          label="Cancel booking"
          variant="danger"
          fullWidth
          disabled={busy}
          onPress={() => {
            setActionError(null);
            setNotice(null);
            setNote('');
            setMode('cancel');
          }}
        />
      ) : null}
      {!canAccept(b) && !canReject(b) && !canStart(b) && !canComplete(b) && !canCancel(b) ? (
        <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 20 }}>
          No actions are available for this booking in its current status.
        </Text>
      ) : null}

      <Sheet
        visible={mode !== 'none'}
        onClose={closeSheet}
        title={
          mode === 'reject'
            ? 'Decline request'
            : mode === 'complete'
              ? 'Complete booking'
              : mode === 'cancel'
                ? 'Cancel booking'
                : 'Booking'
        }
        subtitle={`${b.listingTitle ?? 'Booking'} · ${reference}`}
        dismissOnBackdrop={!busy}
        footer={
          mode === 'reject' ? (
            <Button
              label="Decline request"
              variant="danger"
              fullWidth
              loading={reject.isPending}
              disabled={note.trim().length < 3}
              onPress={() => reject.mutate(note.trim())}
            />
          ) : mode === 'complete' ? (
            <Button
              label="Mark as completed"
              fullWidth
              loading={complete.isPending}
              onPress={() => complete.mutate(note.trim() || undefined)}
            />
          ) : mode === 'cancel' ? (
            <Button
              label="Cancel booking"
              variant="danger"
              fullWidth
              loading={cancel.isPending}
              onPress={() => cancel.mutate(note.trim() || 'Cancelled by partner')}
            />
          ) : undefined
        }
      >
        {actionError ? <Banner tone="danger" message={actionError} /> : null}

        {mode === 'reject' ? (
          <>
            <Text style={[styles.sheetCopy, { color: t.muted }]}>
              The customer is told the request was declined along with your reason.
            </Text>
            <TextField
              label="Reason for declining"
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Fully booked, dates unavailable…"
              hint="At least 3 characters."
              accessibilityLabel="Reason for declining"
            />
          </>
        ) : null}

        {mode === 'complete' ? (
          <>
            <Text style={[styles.sheetCopy, { color: t.muted }]}>
              Marking the booking complete lets the customer leave a review.
            </Text>
            <TextField
              label="Completion note (optional)"
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Handed over keys, space cleaned…"
              accessibilityLabel="Completion note"
            />
          </>
        ) : null}

        {mode === 'cancel' ? (
          <>
            <Banner
              tone="danger"
              title="Cancel this booking?"
              message="The customer is notified immediately and the booking cannot be reopened."
            />
            <TextField
              label="Reason (optional)"
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Space unavailable, maintenance…"
              accessibilityLabel="Reason for cancelling"
            />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backBar: { marginBottom: 2 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  backTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  cover: { width: '100%', height: 170, borderRadius: 16 },
  messageIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6 },
  timelineRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  sheetCopy: { fontSize: 14, lineHeight: 20 },
});
