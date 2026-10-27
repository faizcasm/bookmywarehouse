/**
 * Admin bookings — every platform booking (read-only) with status filters,
 * search, and a link through to the full booking detail screen.
 */

import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import {
  Badge,
  Card,
  Screen,
  Segmented,
  SignInPrompt,
  TextField,
  type SegmentedOption,
} from '@/components/ui';
import { listAdminBookings } from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { BOOKING_STATUS_META, formatDayRange, formatMoney, humanize } from '@/utils/format';
import type { Booking } from '@/types';

const STATUS_OPTIONS: SegmentedOption[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT,PENDING_APPROVAL,AWAITING_PAYMENT', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'IN_PROGRESS', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED,REJECTED', label: 'Cancelled' },
  { value: 'REFUND_PENDING,REFUNDED', label: 'Refunds' },
  { value: 'DISPUTED', label: 'Disputed' },
];

export default function AdminBookingsScreen() {
  const t = useTheme();
  const { user } = useSession();

  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(value.trim()), 300);
  };

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to view bookings"
          subtitle="The bookings console is only available to platform administrators."
          next="/(admin)/(tabs)/bookings"
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Bookings</Text>
        <Text style={[styles.subheading, { color: t.muted }]}>
          Every booking on the platform, across all partners.
        </Text>
      </View>

      <PaginatedList<Booking>
        queryKey={['admin-bookings', status, search]}
        fetchPage={(page) =>
          listAdminBookings({
            page,
            limit: 20,
            status: status || undefined,
            q: search || undefined,
          })
        }
        keyExtractor={(b) => b.id}
        emptyTitle="No bookings found"
        emptySubtitle="Try a different status or search term."
        itemHeight={168}
        header={
          <View style={styles.filters}>
            <TextField
              label="Search bookings"
              value={searchInput}
              onChangeText={onSearchChange}
              placeholder="Reference, listing or city"
              autoCapitalize="none"
              returnKeyType="search"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
              <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} equalWidth={false} />
            </ScrollView>
          </View>
        }
        renderItem={(b) => {
          const meta = BOOKING_STATUS_META[b.status];
          return (
            <Card
              style={styles.rowCard}
              onPress={() => router.push(`/(admin)/bookings/${b.id}` as never)}
            >
              <View style={styles.rowTop}>
                <View style={styles.rowTitleWrap}>
                  <Text style={[styles.reference, { color: t.brand }]}>
                    {b.reference ?? 'No reference'}
                  </Text>
                  <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={1}>
                    {b.listingTitle ?? 'Booking'}
                  </Text>
                </View>
                <Badge label={meta?.label ?? humanize(b.status)} tone={meta?.tone ?? 'neutral'} />
              </View>
              <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
                {[b.customerName, b.partnerName].filter(Boolean).join(' · ') || 'Participants on file'}
              </Text>
              <Text style={[styles.meta, { color: t.faint }]}>{formatDayRange(b.startDate, b.endDate)}</Text>
              <Text style={[styles.total, { color: t.fgStrong }]}>
                {formatMoney(b.totalMinor, b.currency)}
              </Text>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 12, gap: 2 },
  heading: { fontSize: 24, fontWeight: '800' },
  subheading: { fontSize: 13 },
  filters: { gap: 12 },
  statusRow: { gap: 8, paddingVertical: 2 },
  rowCard: { gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitleWrap: { flex: 1, gap: 2 },
  reference: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  total: { fontSize: 15, fontWeight: '700' },
});
