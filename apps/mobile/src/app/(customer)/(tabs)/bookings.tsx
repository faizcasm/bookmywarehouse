/** Bookings tab — list of the customer's bookings with status tabs. */

import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { listBookings } from '@/services/api/bookings';
import { formatDayRange, formatMoney, BOOKING_STATUS_META } from '@/utils/format';
import type { Booking } from '@/types';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'PENDING_APPROVAL', label: 'Pending' },
  { key: 'AWAITING_PAYMENT', label: 'Unpaid' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'IN_PROGRESS', label: 'Active' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function BookingsScreen() {
  const t = useTheme();
  const { status } = useSession();
  const [filter, setFilter] = useState('all');

  const query = useQuery({
    queryKey: ['bookings', filter],
    queryFn: () => listBookings(filter === 'all' ? {} : { status: filter }),
    enabled: status === 'authenticated',
  });

  if (status !== 'authenticated') {
    return (
      <Screen>
        <EmptyState
          title="Sign in to see your bookings"
          subtitle="Your bookings and invoices appear here once you're signed in."
          actionLabel="Sign in"
          onAction={() => router.push('/(auth)/login')}
        />
      </Screen>
    );
  }

  return (
    <Screen padTop={false} style={styles.screen}>
      <View style={styles.tabs}>
        {FILTERS.map((f) => (
          <Text
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.tab, { backgroundColor: filter === f.key ? t.brand : t.surface, borderColor: filter === f.key ? t.brand : t.line, color: filter === f.key ? t.brandFg : t.fg }]}
          >
            {f.label}
          </Text>
        ))}
      </View>

      {query.isLoading ? (
        <View style={styles.list}>
          {[0, 1].map((i) => (
            <Skeleton key={i} height={120} radius={16} />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data && query.data.items.length ? (
        <FlatList
          data={query.data.items}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => <BookingRow booking={item} />}
          contentContainerStyle={styles.list}
        />
      ) : (
        <EmptyState title="No bookings" subtitle="Bookings you create will show up here." />
      )}
    </Screen>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const t = useTheme();
  const meta = BOOKING_STATUS_META[booking.status];
  return (
    <Card onPress={() => router.push(`/(customer)/booking/${booking.id}`)}>
      <View style={styles.rowTop}>
        <Text style={[styles.rowTitle, { color: t.fgStrong }]} numberOfLines={1}>
          {booking.listingTitle ?? 'Booking'}
        </Text>
        <Badge label={meta?.label ?? booking.status} tone={meta?.tone ?? 'neutral'} />
      </View>
      <Text style={{ color: t.muted }}>{formatDayRange(booking.startDate, booking.endDate)}</Text>
      <Text style={[styles.rowPrice, { color: t.fgStrong }]}>{formatMoney(booking.totalMinor, booking.currency)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, gap: 12 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, overflow: 'hidden', fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  rowPrice: { fontSize: 15, fontWeight: '700', marginTop: 4 },
});