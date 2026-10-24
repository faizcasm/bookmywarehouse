/** Partner bookings — incoming requests with confirm/start/complete actions. */

import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listPartnerBookings } from '@/services/api/partner';
import { formatDayRange, formatMoney, BOOKING_STATUS_META } from '@/utils/format';

export default function PartnerBookingsScreen() {
  const t = useTheme();

  const bookings = useQuery({ queryKey: ['partner-bookings'], queryFn: () => listPartnerBookings({ limit: 50 }) });

  if (bookings.isLoading) {
    return (
      <Screen scroll>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={100} radius={16} />
        ))}
      </Screen>
    );
  }
  if (bookings.isError) {
    return (
      <Screen>
        <ErrorState error={bookings.error} onRetry={() => bookings.refetch()} />
      </Screen>
    );
  }

  const items = bookings.data?.items ?? [];

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Bookings</Text>
      {items.length ? (
        <View style={styles.list}>
          {items.map((b) => {
            const meta = BOOKING_STATUS_META[b.status];
            return (
              <Card key={b.id} onPress={() => router.push(`/(partner)/booking/${b.id}`)}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={1}>
                      {b.listingTitle ?? 'Booking'}
                    </Text>
                    <Text style={{ color: t.muted, fontSize: 13 }}>{b.customerName}</Text>
                    <Text style={{ color: t.muted, fontSize: 13 }}>{formatDayRange(b.startDate, b.endDate)}</Text>
                    <Text style={{ color: t.fgStrong, fontWeight: '700', marginTop: 4 }}>
                      {formatMoney(b.totalMinor, b.currency)}
                    </Text>
                  </View>
                  <Badge label={meta?.label ?? b.status} tone={meta?.tone ?? 'neutral'} />
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <EmptyState title="No bookings" subtitle="Requests for your listings will appear here." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, gap: 12 },
  heading: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16 },
  list: { paddingHorizontal: 16, gap: 12, paddingBottom: 24 },
  row: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
});
