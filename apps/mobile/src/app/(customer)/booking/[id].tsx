/** Booking detail — timeline, status, actions, and the payment flow. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, ErrorState, LoadingOverlay, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getBooking, cancelBooking } from '@/services/api/bookings';
import { getPaymentConfig, initiatePayment, simulatePayment } from '@/services/api/payments';
import { formatDayRange, formatMoney, formatDateTime, BOOKING_STATUS_META } from '@/utils/format';
import { ApiError } from '@/services/api/client';

export default function BookingDetailScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const booking = useQuery({
    queryKey: ['booking', id],
    queryFn: () => getBooking(id!),
    enabled: !!id,
  });

  const config = useQuery({ queryKey: ['payment-config'], queryFn: getPaymentConfig });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['booking', id] });
    qc.invalidateQueries({ queryKey: ['bookings'] });
  };

  const pay = useMutation({
    mutationFn: async () => {
      const init = await initiatePayment(id!);
      if (init.sandbox && init.paymentId) {
        return simulatePayment(init.paymentId, 'success');
      }
      throw new Error('Live payment requires the Razorpay checkout, available in the full release.');
    },
    onSuccess: () => {
      Alert.alert('Payment successful', 'Your booking is confirmed.', [{ text: 'OK', onPress: invalidate }]);
    },
    onError: (err) => Alert.alert('Payment failed', err instanceof ApiError ? err.message : err.message),
  });

  const cancel = useMutation({
    mutationFn: () => cancelBooking(id!),
    onSuccess: () => {
      Alert.alert('Booking cancelled', undefined, [{ text: 'OK', onPress: invalidate }]);
    },
    onError: (err) => Alert.alert('Could not cancel', err instanceof ApiError ? err.message : 'Try again.'),
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
  const canPay = b.status === 'AWAITING_PAYMENT';
  const canCancel = b.status === 'PENDING_APPROVAL' || b.status === 'AWAITING_PAYMENT';

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.fgStrong }]}>{b.listingTitle ?? 'Booking'}</Text>
        <Badge label={meta?.label ?? b.status} tone={meta?.tone ?? 'neutral'} />
      </View>

      <Card>
        <Text style={{ color: t.muted }}>{formatDayRange(b.startDate, b.endDate)}</Text>
        <Text style={[styles.total, { color: t.fgStrong }]}>{formatMoney(b.totalMinor, b.currency)}</Text>
        <Text style={{ color: t.faint, fontSize: 12 }}>Created {formatDateTime(b.createdAt)}</Text>
        {b.reference ? <Text style={{ color: t.faint, fontSize: 12 }}>Ref {b.reference}</Text> : null}
      </Card>

      {b.timeline?.length ? (
        <Card>
          <Text style={[styles.cardTitle, { color: t.fgStrong }]}>Timeline</Text>
          {b.timeline.map((ev, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={[styles.dot, { backgroundColor: t.brand }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.fg, fontWeight: '600' }}>{BOOKING_STATUS_META[ev.status as keyof typeof BOOKING_STATUS_META]?.label ?? ev.status}</Text>
                <Text style={{ color: t.faint, fontSize: 12 }}>{formatDateTime(ev.at)}</Text>
                {ev.note ? <Text style={{ color: t.muted, fontSize: 13 }}>{ev.note}</Text> : null}
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {canPay ? (
        <Button
          label={config.data?.sandbox ? 'Pay now (sandbox)' : 'Pay now'}
          onPress={() => pay.mutate()}
          loading={pay.isPending}
          fullWidth
        />
      ) : null}

      {canCancel ? (
        <Button
          label="Cancel booking"
          variant="danger"
          onPress={() =>
            Alert.alert('Cancel booking', 'Are you sure?', [
              { text: 'Keep', style: 'cancel' },
              { text: 'Cancel booking', style: 'destructive', onPress: () => cancel.mutate() },
            ])
          }
          loading={cancel.isPending}
          fullWidth
        />
      ) : null}

      <Button label="Message partner" variant="secondary" onPress={() => router.push('/(customer)/(tabs)/messages')} fullWidth />
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