/** Admin bookings — all bookings with refund action. */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Button, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAdminBookings, refundBooking } from '@/services/api/admin';
import { formatDayRange, formatMoney, BOOKING_STATUS_META } from '@/utils/format';
import type { Booking } from '@/types';

export default function AdminBookingsScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const refund = useMutation({
    mutationFn: ({ id, amountMinor }: { id: string; amountMinor: number }) => refundBooking(id, amountMinor),
    onSuccess: () => {
      Alert.alert('Refund issued', 'The refund has been queued.');
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
    },
    onError: (e) => Alert.alert('Could not refund', e instanceof Error ? e.message : 'Try again.'),
  });

  const confirmRefund = (b: Booking) => {
    // Full refund by default; a custom amount can be entered on the detail view.
    Alert.alert('Refund booking', `Refund the full ${formatMoney(b.totalMinor, b.currency)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Refund full', style: 'destructive', onPress: () => refund.mutate({ id: b.id, amountMinor: b.totalMinor }) },
    ]);
  };

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Bookings</Text>
      <PaginatedList<Booking>
        queryKey={['admin-bookings']}
        fetchPage={(page) => listAdminBookings({ page, limit: 20 })}
        keyExtractor={(b) => b.id}
        emptyTitle="No bookings"
        emptySubtitle="All platform bookings will appear here."
        itemHeight={130}
        renderItem={(b) => {
          const meta = BOOKING_STATUS_META[b.status];
          return (
            <Card style={{ gap: 6 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={1}>
                    {b.listingTitle ?? b.id}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>{b.customerName ?? b.id}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>{formatDayRange(b.startDate, b.endDate)}</Text>
                  <Text style={{ color: t.fgStrong, fontWeight: '700', marginTop: 2 }}>
                    {formatMoney(b.totalMinor, b.currency)}
                  </Text>
                </View>
                <Badge label={meta?.label ?? b.status} tone={meta?.tone ?? 'neutral'} />
              </View>
              {(b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'COMPLETED') ? (
                <Button label="Issue refund" variant="danger" onPress={() => confirmRefund(b)} loading={refund.isPending} />
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  heading: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16 },
  row: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
});
