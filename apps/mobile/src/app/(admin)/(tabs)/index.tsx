/**
 * Admin dashboard — platform KPIs, revenue, 14-day trend charts, recent
 * bookings/disputes and quick actions into every pending-work queue.
 */

import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Card,
  ChartCard,
  ColumnChart,
  ErrorState,
  LinkRow,
  SectionHeader,
  SignInPrompt,
  Skeleton,
  Stat,
  StatGrid,
} from '@/components/ui';
import { getAdminDashboard } from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import {
  BOOKING_STATUS_META,
  formatDayLabel,
  formatDayRange,
  formatMoney,
  formatMoneyCompact,
  humanize,
  shortenId,
} from '@/utils/format';

export default function AdminDashboardScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    enabled: !!user,
    staleTime: 30_000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await dashboard.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.flex, { backgroundColor: t.bgPage, paddingTop: insets.top }]}>
        <SignInPrompt
          title="Sign in to the admin console"
          subtitle="The operations console is only available to platform administrators."
          next="/(admin)/(tabs)"
        />
      </View>
    );
  }

  if (dashboard.isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: t.bgPage, paddingTop: insets.top + 16 }]}>
        <View style={styles.padded}>
          <Skeleton height={32} radius={12} />
        </View>
        <View style={[styles.padded, styles.stack]}>
          {[0, 1].map((i) => (
            <View key={`kpi-${i}`} style={styles.gridRow}>
              {[0, 1, 2].map((c) => (
                <Skeleton key={`kpi-${i}-${c}`} height={92} radius={16} style={styles.flex} />
              ))}
            </View>
          ))}
          <Skeleton height={200} radius={16} />
          <Skeleton height={200} radius={16} />
        </View>
      </View>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <View style={[styles.flex, { backgroundColor: t.bgPage, paddingTop: insets.top }]}>
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      </View>
    );
  }

  const d = dashboard.data;
  const totals = d.totals;
  const revenue = d.revenue;
  const currency = revenue.currency;

  const bookingSeries = d.trends.map((point) => ({
    label: formatDayLabel(point.date),
    value: point.bookings,
    display: String(point.bookings),
  }));
  const grossSeries = d.trends.slice(-7).map((point) => ({
    label: formatDayLabel(point.date),
    value: Math.round(point.grossAmount / 100),
    display: formatMoneyCompact(point.grossAmount, currency),
  }));
  const grossLast7 = d.trends.slice(-7).reduce((sum, point) => sum + point.grossAmount, 0);

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: t.bgPage }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) + 24 },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.brand]} tintColor={t.brand} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Overview</Text>
        <Text style={[styles.subheading, { color: t.muted }]}>
          Live platform health and everything waiting on you.
        </Text>
      </View>

      <SectionHeader title="Platform KPIs" />
      <StatGrid columns={3}>
        <Stat key="customers" label="Customers" value={totals.customers} onPress={() => router.push('/(admin)/(tabs)/users' as never)} />
        <Stat key="partners" label="Partners" value={totals.partners} onPress={() => router.push('/(admin)/partners' as never)} />
        <Stat key="verified" label="Verified" value={totals.verifiedPartners} tone="success" onPress={() => router.push('/(admin)/partners' as never)} />
        <Stat key="listings" label="Listings" value={totals.listings} onPress={() => router.push('/(admin)/(tabs)/listings' as never)} />
        <Stat key="active" label="Active" value={totals.activeListings} tone="success" onPress={() => router.push('/(admin)/(tabs)/listings' as never)} />
        <Stat key="bookings" label="Bookings" value={totals.bookings} onPress={() => router.push('/(admin)/(tabs)/bookings' as never)} />
        <Stat key="pending-bookings" label="Pending" value={totals.pendingBookings} tone={totals.pendingBookings > 0 ? 'warn' : 'neutral'} onPress={() => router.push('/(admin)/(tabs)/bookings' as never)} />
        <Stat key="pending-verifications" label="KYC pending" value={totals.pendingVerifications} tone={totals.pendingVerifications > 0 ? 'warn' : 'neutral'} onPress={() => router.push('/(admin)/verifications' as never)} />
        <Stat key="pending-listings" label="Review queue" value={totals.pendingListings} tone={totals.pendingListings > 0 ? 'warn' : 'neutral'} onPress={() => router.push('/(admin)/(tabs)/listings' as never)} />
        <Stat key="disputes" label="Disputes open" value={totals.disputesOpen} tone={totals.disputesOpen > 0 ? 'danger' : 'neutral'} onPress={() => router.push('/(admin)/disputes' as never)} />
      </StatGrid>

      <SectionHeader title={`Revenue · last ${revenue.periodDays} days`} />
      <StatGrid columns={2}>
        <Stat key="gross" label="Gross collected" value={formatMoneyCompact(revenue.grossCollected, currency)} hint={`Last ${revenue.periodDays} days`} tone="brand" />
        <Stat key="fees" label="Platform fees" value={formatMoneyCompact(revenue.platformFees, currency)} hint={`${revenue.periodDays}-day total`} />
        <Stat key="refunds" label="Refunds" value={formatMoneyCompact(revenue.refunds, currency)} hint={`${revenue.periodDays}-day total`} tone={revenue.refunds > 0 ? 'warn' : 'neutral'} />
        <Stat key="net" label="Net collected" value={formatMoneyCompact(revenue.netCollected, currency)} hint={`After refunds · ${revenue.periodDays} days`} tone="success" />
      </StatGrid>

      {bookingSeries.length > 0 ? (
        <ChartCard
          title="Bookings per day"
          subtitle={`Last ${bookingSeries.length} days · peak ${Math.max(...bookingSeries.map((p) => p.value))} bookings`}
        >
          <ColumnChart data={bookingSeries} compact={bookingSeries.length > 7} />
        </ChartCard>
      ) : null}

      {grossSeries.length > 0 ? (
        <ChartCard
          title="Gross volume per day"
          subtitle={`${formatMoney(grossLast7, currency)} collected over the last ${grossSeries.length} days`}
        >
          <ColumnChart data={grossSeries} />
        </ChartCard>
      ) : null}

      <SectionHeader title="Needs attention" />
      <Card padded={false} style={styles.actionsCard}>
        <LinkRow
          label="Pending verifications"
          subtitle="Review partner KYC submissions"
          badge={totals.pendingVerifications || undefined}
          onPress={() => router.push('/(admin)/verifications' as never)}
        />
        <LinkRow
          label="Listings awaiting review"
          subtitle="Approve or reject listing submissions"
          badge={totals.pendingListings || undefined}
          onPress={() => router.push('/(admin)/(tabs)/listings' as never)}
        />
        <LinkRow
          label="Open disputes"
          subtitle="Resolve cases raised by customers"
          badge={totals.disputesOpen || undefined}
          danger={totals.disputesOpen > 0}
          onPress={() => router.push('/(admin)/disputes' as never)}
        />
        <LinkRow
          label="Partner directory"
          subtitle="Browse partners, payouts and decisions"
          onPress={() => router.push('/(admin)/partners' as never)}
        />
      </Card>

      <SectionHeader
        title="Recent bookings"
        actionLabel="View all"
        onAction={() => router.push('/(admin)/(tabs)/bookings' as never)}
      />
      <Card padded={false}>
        {d.recentBookings.length === 0 ? (
          <Text style={[styles.emptyRow, { color: t.muted }]}>No bookings yet.</Text>
        ) : (
          d.recentBookings.slice(0, 6).map((b) => {
            const meta = BOOKING_STATUS_META[b.status];
            return (
              <LinkRow
                key={b.id}
                label={b.listingTitle ?? b.reference ?? 'Booking'}
                subtitle={`${b.reference ?? shortenId(b.id)} · ${formatDayRange(b.startDate, b.endDate)}`}
                value={meta?.label ?? humanize(b.status)}
                onPress={() => router.push(`/(admin)/bookings/${b.id}` as never)}
              />
            );
          })
        )}
      </Card>

      <SectionHeader
        title="Recent disputes"
        actionLabel="View all"
        onAction={() => router.push('/(admin)/disputes' as never)}
      />
      <Card padded={false}>
        {d.recentDisputes.length === 0 ? (
          <Text style={[styles.emptyRow, { color: t.muted }]}>No disputes raised.</Text>
        ) : (
          d.recentDisputes.slice(0, 5).map((dispute) => (
            <LinkRow
              key={dispute.id}
              label={humanize(dispute.reason)}
              subtitle={`Booking ${shortenId(dispute.bookingId)} · ${BOOKING_STATUS_META[dispute.status as keyof typeof BOOKING_STATUS_META]?.label ?? humanize(dispute.status)}`}
              value={humanize(dispute.status)}
              onPress={() => router.push('/(admin)/disputes' as never)}
            />
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 16 },
  padded: { paddingHorizontal: 16 },
  stack: { gap: 12, marginTop: 16 },
  gridRow: { flexDirection: 'row', gap: 12 },
  heading: { fontSize: 24, fontWeight: '800' },
  subheading: { fontSize: 14, marginTop: 2 },
  actionsCard: { paddingVertical: 4 },
  emptyRow: { paddingHorizontal: 16, paddingVertical: 16, fontSize: 14 },
});
