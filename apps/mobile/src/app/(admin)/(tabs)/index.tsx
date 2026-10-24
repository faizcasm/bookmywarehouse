/** Admin dashboard — platform KPIs + pending-work shortcuts. */

import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getAdminDashboard, listVerifications, listAdminDisputes } from '@/services/api/admin';
import { formatMoneyCompact } from '@/utils/format';

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: t.surface2 }]}>
      <Text style={[styles.statValue, { color: t.fgStrong }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const t = useTheme();

  const dashboard = useQuery({ queryKey: ['admin-dashboard'], queryFn: getAdminDashboard });
  const verifications = useQuery({
    queryKey: ['admin-pending-verifications'],
    queryFn: () => listVerifications({ status: 'PENDING', limit: 1 }),
  });
  const disputes = useQuery({
    queryKey: ['admin-open-disputes'],
    queryFn: () => listAdminDisputes({ status: 'OPEN', limit: 1 }),
  });

  if (dashboard.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={40} radius={12} />
        <View style={styles.stats}>
          {[0, 1].map((i) => (
            <Skeleton key={i} height={80} radius={16} style={{ flex: 1 }} />
          ))}
        </View>
      </Screen>
    );
  }
  if (dashboard.isError) {
    return (
      <Screen>
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      </Screen>
    );
  }

  const totals = (dashboard.data?.totals ?? {}) as Record<string, number>;
  const gbp = (key: string) => (totals[key] != null ? String(totals[key]) : '—');
  const gmoney = (key: string) => formatMoneyCompact(totals[key] ?? 0);

  const pendingVerifications = verifications.data?.meta?.pagination?.totalItems ?? 0;
  const openDisputes = disputes.data?.meta?.pagination?.totalItems ?? 0;

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Overview</Text>

      <View style={styles.stats}>
        <Stat label="Users" value={gbp('users')} />
        <Stat label="Partners" value={gbp('partners')} />
      </View>
      <View style={styles.stats}>
        <Stat label="Listings" value={gbp('listings')} />
        <Stat label="Bookings" value={gbp('bookings')} />
      </View>
      <View style={styles.stats}>
        <Stat label="Payments" value={gbp('payments')} />
        <Stat label="GMV" value={gmoney('gmvMinor')} />
      </View>

      <Card onPress={() => router.push('/(admin)/verifications')} style={styles.shortcut}>
        <Text style={{ color: t.fgStrong, fontWeight: '700' }}>
          {pendingVerifications} verification{pendingVerifications === 1 ? '' : 's'} pending review
        </Text>
        <Text style={{ color: t.brand, marginTop: 4 }}>Review now →</Text>
      </Card>

      <Card onPress={() => router.push('/(admin)/disputes')} style={styles.shortcut}>
        <Text style={{ color: t.fgStrong, fontWeight: '700' }}>
          {openDisputes} open dispute{openDisputes === 1 ? '' : 's'}
        </Text>
        <Text style={{ color: t.brand, marginTop: 4 }}>Resolve now →</Text>
      </Card>

      {dashboard.data?.recentBookings?.length ? (
        <>
          <Text style={[styles.sectionTitle, { color: t.fgStrong }]}>Recent bookings</Text>
          <Card>
            {dashboard.data.recentBookings.slice(0, 5).map((b) => (
              <View key={b.id} style={styles.bookRow}>
                <Text style={{ color: t.fg, flex: 1 }} numberOfLines={1}>
                  {b.listingTitle ?? b.id}
                </Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>{b.status}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderRadius: 16, padding: 16, gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 13 },
  shortcut: { marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
});
