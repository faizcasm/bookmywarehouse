/** Admin bookings — all platform bookings (read-only). */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAdminBookings } from '@/services/api/admin';
import { formatDayRange, formatMoney, BOOKING_STATUS_META } from '@/utils/format';
import type { Booking } from '@/types';

export default function AdminBookingsScreen() {
  const t = useTheme();

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
                  <Text style={{ color: t.muted, fontSize: 13 }}>{b.customerName ?? b.partnerName ?? b.id}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>{formatDayRange(b.startDate, b.endDate)}</Text>
                  <Text style={{ color: t.fgStrong, fontWeight: '700', marginTop: 2 }}>
                    {formatMoney(b.totalMinor, b.currency)}
                  </Text>
                </View>
                <Badge label={meta?.label ?? b.status} tone={meta?.tone ?? 'neutral'} />
              </View>
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
