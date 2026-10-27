/**
 * Admin booking detail — read-only booking record: parties, dates, totals,
 * status timeline, plus contextual links (disputes when disputed, invoices
 * once completed). Admin booking changes go through disputes, so there are
 * no inline state-transition actions here.
 */

import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import {
  Badge,
  Button,
  Card,
  ErrorState,
  KeyValue,
  LoadingOverlay,
  Screen,
  SectionHeader,
  SignInPrompt,
  type KeyValueItem,
} from '@/components/ui';
import { getBooking } from '@/services/api/bookings';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import {
  BOOKING_STATUS_META,
  formatDateTime,
  formatDayRange,
  formatMoney,
  humanize,
} from '@/utils/format';

export default function AdminBookingDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();

  const booking = useQuery({
    queryKey: ['booking', id],
    queryFn: () => getBooking(id!),
    enabled: !!id && !!user,
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to view this booking"
          subtitle="Booking records are restricted to platform administrators."
          next="/(admin)/bookings"
        />
      </Screen>
    );
  }

  if (booking.isLoading) return <LoadingOverlay />;

  if (booking.isError || !booking.data) {
    return (
      <Screen>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.back, { backgroundColor: t.surface2 }, pressed && { opacity: 0.7 }]}
          >
            <ChevronLeft size={22} color={t.fg} />
          </Pressable>
        </View>
        <ErrorState error={booking.error} onRetry={() => booking.refetch()} />
      </Screen>
    );
  }

  const b = booking.data;
  const meta = BOOKING_STATUS_META[b.status];

  const summaryItems: KeyValueItem[] = [
    { label: 'Reference', value: b.reference ?? b.id },
    { label: 'Status', value: <Badge label={meta?.label ?? humanize(b.status)} tone={meta?.tone ?? 'neutral'} /> },
    { label: 'Dates', value: formatDayRange(b.startDate, b.endDate) },
    { label: 'Space units', value: String(b.spaceUnits) },
    { label: 'Total', value: formatMoney(b.totalMinor, b.currency) },
    { label: 'Booked on', value: formatDateTime(b.createdAt) },
  ];

  const partyItems: KeyValueItem[] = [
    { label: 'Customer', value: b.customerName ?? '—' },
    { label: 'Partner', value: b.partnerName ?? '—' },
    { label: 'Listing', value: b.listingTitle ?? '—', block: true },
  ];

  const timeline = b.timeline ?? [];

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, { backgroundColor: t.surface2 }, pressed && { opacity: 0.7 }]}
        >
          <ChevronLeft size={22} color={t.fg} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.heading, { color: t.fgStrong }]} numberOfLines={1}>
            {b.listingTitle ?? 'Booking'}
          </Text>
          <Text style={[styles.subheading, { color: t.muted }]} numberOfLines={1}>
            {b.reference ?? b.id}
          </Text>
        </View>
      </View>

      <Card>
        <KeyValue items={summaryItems} />
      </Card>

      <SectionHeader title="Parties" />
      <Card>
        <KeyValue items={partyItems} />
      </Card>

      {b.status === 'DISPUTED' ? (
        <Button
          label="Open disputes"
          variant="secondary"
          onPress={() => router.push('/(admin)/disputes' as never)}
        />
      ) : null}
      {b.status === 'COMPLETED' || b.status === 'REFUNDED' ? (
        <Button
          label="View invoices"
          variant="secondary"
          onPress={() => router.push('/(admin)/invoices' as never)}
        />
      ) : null}

      <SectionHeader title="Timeline" />
      {timeline.length === 0 ? (
        <Card>
          <Text style={[styles.empty, { color: t.muted }]}>
            No status changes recorded for this booking yet.
          </Text>
        </Card>
      ) : (
        <Card padded={false}>
          {timeline.map((event, index) => {
            const eventMeta = BOOKING_STATUS_META[event.status as keyof typeof BOOKING_STATUS_META];
            return (
              <View
                key={`${event.status}-${event.at}-${index}`}
                style={[
                  styles.timelineRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line },
                ]}
              >
                <View style={styles.timelineText}>
                  <Badge
                    label={eventMeta?.label ?? humanize(event.status)}
                    tone={eventMeta?.tone ?? 'neutral'}
                  />
                  <Text style={[styles.timelineTime, { color: t.muted }]}>{formatDateTime(event.at)}</Text>
                  {event.note ? (
                    <Text style={[styles.timelineNote, { color: t.fg }]}>{event.note}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  headerText: { flex: 1 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 22, fontWeight: '800' },
  subheading: { fontSize: 13, marginTop: 2 },
  empty: { fontSize: 14, padding: 16 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  timelineText: { flex: 1, gap: 4, alignItems: 'flex-start' },
  timelineTime: { fontSize: 12.5 },
  timelineNote: { fontSize: 13.5, lineHeight: 19 },
});
