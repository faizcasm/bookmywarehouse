/** Partner dashboard — KPIs, verification prompt, recent bookings. */

import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getPartnerDashboard, getVerificationState } from '@/services/api/partner';
import { formatMoney, BOOKING_STATUS_META } from '@/utils/format';

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: accent ? t.brandSoft : t.surface2 }]}>
      <Text style={[styles.statValue, { color: accent ? t.brandSoftFg : t.fgStrong }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: accent ? t.brandSoftFg : t.muted }]}>{label}</Text>
    </View>
  );
}

export default function PartnerDashboardScreen() {
  const t = useTheme();

  const dashboard = useQuery({ queryKey: ['partner-dashboard'], queryFn: getPartnerDashboard });
  const verification = useQuery({ queryKey: ['verification'], queryFn: getVerificationState });

  if (dashboard.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={40} radius={12} />
        <View style={styles.stats}>
          {[0, 1].map((i) => (
            <Skeleton key={i} height={80} radius={16} style={{ flex: 1 }} />
          ))}
        </View>
        <Skeleton height={140} radius={16} />
      </Screen>
    );
  }

  const d = dashboard.data ?? {};
  const pendingVerification = verification.data && verification.data.status !== 'VERIFIED';

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Overview</Text>

      {pendingVerification ? (
        <Card style={{ borderColor: t.warning, borderWidth: 1 }}>
          <Text style={{ color: t.fgStrong, fontWeight: '700' }}>Verification needed</Text>
          <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>
            Verify your business to publish listings and accept bookings.
          </Text>
          <Text
            onPress={() => router.push('/(partner)/verification')}
            style={{ color: t.brand, fontWeight: '600', marginTop: 8 }}
          >
            Complete verification →
          </Text>
        </Card>
      ) : null}

      <View style={styles.stats}>
        <Stat label="Active listings" value={String(d.activeListings ?? 0)} accent />
        <Stat label="Pending bookings" value={String(d.pendingBookings ?? 0)} />
      </View>
      <View style={styles.stats}>
        <Stat
          label="Total earnings"
          value={formatMoney(d.totalEarningsMinor ?? 0, d.currency ?? 'INR')}
        />
        <Stat label="Avg rating" value={d.ratingAvg ? d.ratingAvg.toFixed(1) : '—'} />
      </View>

      <Text style={[styles.sectionTitle, { color: t.fgStrong }]}>Recent bookings</Text>
      {d.recentBookings?.length ? (
        <View style={{ gap: 12 }}>
          {d.recentBookings.map((b) => {
            const meta = BOOKING_STATUS_META[b.status];
            return (
              <Card key={b.id} onPress={() => router.push(`/(partner)/booking/${b.id}`)}>
                <View style={styles.bookRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.fgStrong, fontWeight: '700' }} numberOfLines={1}>
                      {b.listingTitle ?? 'Booking'}
                    </Text>
                    <Text style={{ color: t.muted, fontSize: 13 }}>{b.customerName}</Text>
                  </View>
                  <Badge label={meta?.label ?? b.status} tone={meta?.tone ?? 'neutral'} />
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <Card>
          <Text style={{ color: t.muted }}>No bookings yet. Published listings will start receiving requests here.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderRadius: 16, padding: 16, gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 13 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
