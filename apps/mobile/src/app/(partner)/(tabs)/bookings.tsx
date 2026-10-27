/**
 * Partner bookings — status filters over the server-paginated list, rich rows,
 * and the full accept/reject/start/complete/cancel lifecycle driven by the
 * booking's `availableActions`.
 */

import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, Ellipsis } from 'lucide-react-native';
import { Image } from 'expo-image';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  TextField,
} from '@/components/ui';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import {
  cancelPartnerBooking,
  completeBooking,
  confirmBooking,
  listPartnerBookings,
  rejectPartnerBooking,
  startBooking,
} from '@/services/api/partner';
import { BOOKING_STATUS_META, formatDayRange, formatMoney, shortenId } from '@/utils/format';
import type { Booking } from '@/types';

/** Every chip maps to real backend BookingStatus values (comma lists allowed). */
const STATUS_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending', status: 'PENDING_APPROVAL' },
  { key: 'CONFIRMED', label: 'Confirmed', status: 'CONFIRMED,AWAITING_PAYMENT' },
  { key: 'ACTIVE', label: 'Active', status: 'IN_PROGRESS' },
  { key: 'COMPLETED', label: 'Completed', status: 'COMPLETED' },
  { key: 'CANCELLED', label: 'Cancelled', status: 'CANCELLED' },
] as const;

const actionsOf = (b: Booking) => b.availableActions ?? [];
const canAccept = (b: Booking) => actionsOf(b).some((a) => a === 'CONFIRMED' || a === 'AWAITING_PAYMENT');
const canReject = (b: Booking) => actionsOf(b).includes('REJECTED');
const canStart = (b: Booking) => actionsOf(b).includes('IN_PROGRESS');
const canComplete = (b: Booking) => actionsOf(b).includes('COMPLETED');
const canCancel = (b: Booking) => actionsOf(b).includes('CANCELLED');

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

type SheetMode = 'menu' | 'reject' | 'complete' | 'cancel';

export default function PartnerBookingsScreen() {
  const t = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<string>('ALL');
  const [selected, setSelected] = useState<Booking | null>(null);
  const [mode, setMode] = useState<SheetMode>('menu');
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const statusParam = (STATUS_FILTERS.find((f) => f.key === filter) as { status?: string } | undefined)
    ?.status;
  const fetchPage = useCallback(
    (page: number) => listPartnerBookings({ page, limit: 10, status: statusParam }),
    [statusParam],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['partner-bookings'] });
    qc.invalidateQueries({ queryKey: ['partner-booking'] });
    qc.invalidateQueries({ queryKey: ['partner-dashboard'] });
  };

  const finish = (message: string) => {
    setSelected(null);
    setMode('menu');
    setNote('');
    setActionError(null);
    setNotice(message);
    invalidate();
  };

  const accept = useMutation({
    mutationFn: (id: string) => confirmBooking(id),
    onSuccess: () => finish('Request accepted — the customer has been notified.'),
    onError: (e) => setActionError(errorText(e)),
  });
  const reject = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => rejectPartnerBooking(vars.id, vars.reason),
    onSuccess: () => finish('Request declined — the customer has been notified.'),
    onError: (e) => setActionError(errorText(e)),
  });
  const start = useMutation({
    mutationFn: (id: string) => startBooking(id),
    onSuccess: () => finish('Booking marked as started.'),
    onError: (e) => setActionError(errorText(e)),
  });
  const complete = useMutation({
    mutationFn: (vars: { id: string; note?: string }) => completeBooking(vars.id, vars.note),
    onSuccess: () => finish('Booking completed — the customer can now review it.'),
    onError: (e) => setActionError(errorText(e)),
  });
  const cancel = useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      cancelPartnerBooking(vars.id, vars.reason),
    onSuccess: () => finish('Booking cancelled — the customer has been notified.'),
    onError: (e) => setActionError(errorText(e)),
  });

  const busy = accept.isPending || reject.isPending || start.isPending || complete.isPending || cancel.isPending;

  const closeSheet = () => {
    if (busy) return;
    setSelected(null);
    setMode('menu');
    setNote('');
    setActionError(null);
  };

  const openActions = (booking: Booking) => {
    setNotice(null);
    setActionError(null);
    setMode('menu');
    setNote('');
    setSelected(booking);
  };

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to see your bookings"
          subtitle="Requests, confirmations and active jobs for your listings live here."
          next="/(partner)/(tabs)/bookings"
        />
      </Screen>
    );
  }

  const booking = selected;
  const meta = booking ? BOOKING_STATUS_META[booking.status] : undefined;

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Bookings</Text>
      </View>

      <View style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            size="sm"
            selected={filter === f.key}
            onPress={() => {
              setFilter(f.key);
              setNotice(null);
            }}
          />
        ))}
      </View>

      {notice ? (
        <View style={styles.notice}>
          <Banner tone="success" message={notice} actionLabel="Dismiss" onAction={() => setNotice(null)} />
        </View>
      ) : null}

      <PaginatedList<Booking>
        queryKey={['partner-bookings', filter]}
        fetchPage={fetchPage}
        keyExtractor={(b) => b.id}
        itemHeight={140}
        emptyTitle={filter === 'ALL' ? 'No bookings yet' : 'No bookings with this status'}
        emptySubtitle={
          filter === 'ALL'
            ? 'Requests for your listings appear here the moment they come in.'
            : 'Try a different status filter to see your other bookings.'
        }
        renderItem={(b) => {
          const itemMeta = BOOKING_STATUS_META[b.status];
          return (
            <Card onPress={() => router.push(`/(partner)/booking/${b.id}` as never)} style={styles.row}>
              {b.coverUrl ? (
                <Image
                  source={{ uri: b.coverUrl }}
                  style={styles.thumb}
                  contentFit="cover"
                  transition={180}
                  accessibilityLabel={b.listingTitle ?? 'Booking'}
                />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: t.surface3 }]}>
                  <PackageCheck size={24} color={t.faint} />
                </View>
              )}

              <View style={styles.info}>
                <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={1}>
                  {b.listingTitle ?? 'Booking'}
                </Text>
                <Text style={{ color: t.muted, fontSize: 12.5, fontWeight: '600' }} numberOfLines={1}>
                  {b.reference ?? shortenId(b.id)} · {b.customerName ?? 'Customer'}
                </Text>
                <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
                  {formatDayRange(b.startDate, b.endDate)}
                </Text>
                <Text style={[styles.price, { color: t.fgStrong }]}>
                  {formatMoney(b.totalMinor, b.currency)}
                </Text>
              </View>

              <View style={styles.rowRight}>
                <Badge label={itemMeta?.label ?? b.status} tone={itemMeta?.tone ?? 'neutral'} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Actions for booking ${b.reference ?? shortenId(b.id)}`}
                  hitSlop={8}
                  onPress={() => openActions(b)}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: t.surface3 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ellipsis size={20} color={t.muted} />
                </Pressable>
              </View>
            </Card>
          );
        }}
      />

      <Sheet
        visible={!!booking}
        onClose={closeSheet}
        title={
          mode === 'reject'
            ? 'Decline request'
            : mode === 'complete'
              ? 'Complete booking'
              : mode === 'cancel'
                ? 'Cancel booking'
                : 'Booking actions'
        }
        subtitle={
          booking
            ? `${booking.listingTitle ?? 'Booking'} · ${booking.reference ?? shortenId(booking.id)}`
            : undefined
        }
        dismissOnBackdrop={!busy}
        footer={
          mode === 'reject' ? (
            <Button
              label="Decline request"
              variant="danger"
              fullWidth
              loading={reject.isPending}
              disabled={note.trim().length < 3}
              onPress={() =>
                booking ? reject.mutate({ id: booking.id, reason: note.trim() }) : undefined
              }
            />
          ) : mode === 'complete' ? (
            <Button
              label="Mark as completed"
              fullWidth
              loading={complete.isPending}
              onPress={() =>
                booking
                  ? complete.mutate({ id: booking.id, note: note.trim() || undefined })
                  : undefined
              }
            />
          ) : mode === 'cancel' ? (
            <Button
              label="Cancel booking"
              variant="danger"
              fullWidth
              loading={cancel.isPending}
              onPress={() =>
                booking
                  ? cancel.mutate({
                      id: booking.id,
                      reason: note.trim() || 'Cancelled by partner',
                    })
                  : undefined
              }
            />
          ) : undefined
        }
      >
        {actionError ? <Banner tone="danger" message={actionError} /> : null}
        {meta ? (
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {meta.label} · {booking ? formatDayRange(booking.startDate, booking.endDate) : ''}
            {booking ? ` · ${formatMoney(booking.totalMinor, booking.currency)}` : ''}
          </Text>
        ) : null}

        {mode === 'menu' && booking ? (
          <>
            <Button
              label="View booking details"
              variant="secondary"
              fullWidth
              onPress={() => {
                const id = booking.id;
                closeSheet();
                router.push(`/(partner)/booking/${id}` as never);
              }}
            />
            {canAccept(booking) ? (
              <Button
                label="Accept request"
                fullWidth
                loading={accept.isPending && accept.variables === booking.id}
                disabled={busy}
                onPress={() => accept.mutate(booking.id)}
              />
            ) : null}
            {canReject(booking) ? (
              <Button
                label="Decline request"
                variant="secondary"
                fullWidth
                disabled={busy}
                onPress={() => {
                  setActionError(null);
                  setNote('');
                  setMode('reject');
                }}
              />
            ) : null}
            {canStart(booking) ? (
              <Button
                label="Start booking"
                fullWidth
                loading={start.isPending && start.variables === booking.id}
                disabled={busy}
                onPress={() => start.mutate(booking.id)}
              />
            ) : null}
            {canComplete(booking) ? (
              <Button
                label="Mark as completed"
                fullWidth
                disabled={busy}
                onPress={() => {
                  setActionError(null);
                  setNote('');
                  setMode('complete');
                }}
              />
            ) : null}
            {canCancel(booking) ? (
              <Button
                label="Cancel booking"
                variant="danger"
                fullWidth
                disabled={busy}
                onPress={() => {
                  setActionError(null);
                  setNote('');
                  setMode('cancel');
                }}
              />
            ) : null}
            {!canAccept(booking) &&
            !canReject(booking) &&
            !canStart(booking) &&
            !canComplete(booking) &&
            !canCancel(booking) ? (
              <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 20 }}>
                No actions are available for this booking in its current status.
              </Text>
            ) : null}
          </>
        ) : null}

        {mode === 'reject' ? (
          <>
            <Text style={{ color: t.fg, fontSize: 14, lineHeight: 20 }}>
              The customer will be told the request was declined along with your reason.
            </Text>
            <TextField
              label="Reason for declining"
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Fully booked, dates unavailable…"
              hint="At least 3 characters."
            />
            <Button
              label="Back"
              variant="ghost"
              onPress={() => setMode('menu')}
              disabled={busy}
            />
          </>
        ) : null}

        {mode === 'complete' ? (
          <>
            <Text style={{ color: t.fg, fontSize: 14, lineHeight: 20 }}>
              Marking the booking complete lets the customer leave a review.
            </Text>
            <TextField
              label="Completion note (optional)"
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Handed over keys, space cleaned…"
            />
            <Button label="Back" variant="ghost" onPress={() => setMode('menu')} disabled={busy} />
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
            />
            <Button label="Back" variant="ghost" onPress={() => setMode('menu')} disabled={busy} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1, gap: 12 },
  header: { paddingHorizontal: 16 },
  heading: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  notice: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: { width: 68, height: 68, borderRadius: 12 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15.5, fontWeight: '700' },
  price: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
