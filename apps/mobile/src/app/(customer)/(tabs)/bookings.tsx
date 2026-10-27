/**
 * Bookings tab — the customer's bookings with server-side status filtering
 * and pagination.
 */

import { router } from 'expo-router';
import { PackageCheck } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Card, Chip, Screen, SignInPrompt } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { listBookings } from '@/services/api/bookings';
import { formatDayRange, formatMoney, shortenId, BOOKING_STATUS_META } from '@/utils/format';
import type { Booking } from '@/types';

/** Every chip maps to a real backend BookingStatus (comma lists supported). */
const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'PENDING_APPROVAL', label: 'Pending' },
  { key: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'IN_PROGRESS', label: 'Active' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function BookingsScreen() {
  const { user } = useSession();
  const [filter, setFilter] = useState('all');

  const fetchPage = useCallback(
    (page: number) =>
      listBookings({ page, limit: 10, status: filter === 'all' ? undefined : filter }),
    [filter],
  );

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to see your bookings"
          subtitle="Your booking requests, confirmations and invoices live here."
          next="/(customer)/(tabs)/bookings"
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            size="sm"
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>

      <PaginatedList<Booking>
        queryKey={['bookings', filter]}
        fetchPage={fetchPage}
        keyExtractor={(b) => b.id}
        itemHeight={118}
        emptyTitle={filter === 'all' ? 'No bookings yet' : 'No bookings with this status'}
        emptySubtitle={
          filter === 'all'
            ? 'Spaces you book will appear here.'
            : 'Try a different status filter to see your other bookings.'
        }
        renderItem={(booking) => <BookingRow booking={booking} />}
      />
    </Screen>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const t = useTheme();
  const meta = BOOKING_STATUS_META[booking.status];
  const reference = booking.reference ?? shortenId(booking.id);

  return (
    <Card onPress={() => router.push(`/(customer)/booking/${booking.id}`)} style={styles.row}>
      {booking.coverUrl ? (
        <Image
          source={{ uri: booking.coverUrl }}
          style={styles.thumb}
          contentFit="cover"
          transition={180}
          accessibilityLabel={booking.listingTitle ?? 'Listing'}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: t.surface3 }]}>
          <PackageCheck size={24} color={t.faint} />
        </View>
      )}

      <View style={styles.info}>
        <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={1}>
          {booking.listingTitle ?? 'Booking'}
        </Text>
        <Text style={[styles.reference, { color: t.muted }]} numberOfLines={1}>
          {reference}
        </Text>
        <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
          {formatDayRange(booking.startDate, booking.endDate)}
        </Text>
        <Text style={[styles.price, { color: t.fgStrong }]}>
          {formatMoney(booking.totalMinor, booking.currency)}
        </Text>
      </View>

      <Badge label={meta?.label ?? booking.status} tone={meta?.tone ?? 'neutral'} />
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, gap: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: { width: 76, height: 76, borderRadius: 12 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15.5, fontWeight: '700' },
  reference: { fontSize: 12.5, fontWeight: '600' },
  price: { fontSize: 15, fontWeight: '800', marginTop: 2 },
});
