/** Partner booking detail — timeline + confirm/start/complete/cancel actions. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, ErrorState, LoadingOverlay, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import {
  getPartnerBooking,
  confirmBooking,
  startBooking,
  completeBooking,
  cancelPartnerBooking,
} from '@/services/api/partner';
import { formatDayRange, formatMoney, formatDateTime, BOOKING_STATUS_META } from '@/utils/format';
import { ApiError } from '@/services/api/client';

export default function PartnerBookingDetailScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const booking = useQuery({
    queryKey: ['partner-booking', id],
    queryFn: () => getPartnerBooking(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['partner-booking', id] });
    qc.invalidateQueries({ queryKey: ['partner-bookings'] });
  };

  const err = (e: unknown) => Alert.alert('Action failed', e instanceof ApiError ? e.message : 'Try again.');

  const confirm = useMutation({ mutationFn: () => confirmBooking(id!), onSuccess: invalidate, onError: err });
  const start = useMutation({ mutationFn: () => startBooking(id!), onSuccess: invalidate, onError: err });
  const complete = useMutation({ mutationFn: () => completeBooking(id!), onSuccess: invalidate, onError: err });
  const cancel = useMutation({
    mutationFn: () => cancelPartnerBooking(id!, 'Cancelled by partner'),
    onSuccess: invalidate,
    onError: err,
  });

  if (booking.isLoading) return <LoadingOverlay />;
  if (booking.isError || !booking.data) {
    return (
      <Screen>
        <ErrorState error={booking.error} onRetry={() => booking.refetch()} />
      </Screen>
    );
  }

  const b = booking.data;
  const meta = BOOKING_STATUS_META[b.status];

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.fgStrong }]}>{b.listingTitle ?? 'Booking'}</Text>
        <Badge label={meta?.label ?? b.status} tone={meta?.tone ?? 'neutral'} />
      </View>

      <Card>
        <Text style={{ color: t.muted }}>Customer: {b.customerName ?? '—'}</Text>
        <Text style={{ color: t.muted }}>{formatDayRange(b.startDate, b.endDate)}</Text>
        <Text style={[styles.total, { color: t.fgStrong }]}>{formatMoney(b.totalMinor, b.currency)}</Text>
        <Text style={{ color: t.faint, fontSize: 12 }}>Created {formatDateTime(b.createdAt)}</Text>
      </Card>

      {b.timeline?.length ? (
        <Card>
          <Text style={[styles.cardTitle, { color: t.fgStrong }]}>Timeline</Text>
          {b.timeline.map((ev, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={[styles.dot, { backgroundColor: t.brand }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.fg, fontWeight: '600' }}>
                  {BOOKING_STATUS_META[ev.status as keyof typeof BOOKING_STATUS_META]?.label ?? ev.status}
                </Text>
                <Text style={{ color: t.faint, fontSize: 12 }}>{formatDateTime(ev.at)}</Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={{ gap: 10 }}>
        {b.status === 'PENDING_APPROVAL' ? (
          <Button label="Confirm booking" onPress={() => confirm.mutate()} loading={confirm.isPending} fullWidth />
        ) : null}
        {b.status === 'CONFIRMED' || b.status === 'AWAITING_PAYMENT' ? (
          <Button label="Mark as started" onPress={() => start.mutate()} loading={start.isPending} fullWidth />
        ) : null}
        {b.status === 'IN_PROGRESS' ? (
          <Button label="Mark as completed" onPress={() => complete.mutate()} loading={complete.isPending} fullWidth />
        ) : null}
        {b.status === 'PENDING_APPROVAL' || b.status === 'CONFIRMED' || b.status === 'AWAITING_PAYMENT' ? (
          <Button
            label="Cancel booking"
            variant="danger"
            onPress={() =>
              Alert.alert('Cancel booking', 'The customer will be notified.', [
                { text: 'Keep', style: 'cancel' },
                { text: 'Cancel booking', style: 'destructive', onPress: () => cancel.mutate() },
              ])
            }
            loading={cancel.isPending}
            fullWidth
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', flexShrink: 1 },
  total: { fontSize: 22, fontWeight: '800', marginVertical: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  timelineRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
