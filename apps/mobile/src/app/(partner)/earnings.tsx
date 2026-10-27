/** Partner earnings — settlement summary + per-booking earnings. */

import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getEarnings } from '@/services/api/partner';
import { formatMoney, formatDate } from '@/utils/format';

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: t.surface2 }]}>
      <Text style={[styles.statValue, { color: t.fgStrong }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

export default function EarningsScreen() {
  const t = useTheme();

  const earnings = useQuery({ queryKey: ['earnings'], queryFn: () => getEarnings() });

  if (earnings.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={100} radius={16} />
        <Skeleton height={200} radius={16} />
      </Screen>
    );
  }
  if (earnings.isError) {
    return (
      <Screen>
        <ErrorState error={earnings.error} onRetry={() => earnings.refetch()} />
      </Screen>
    );
  }

  const d = earnings.data;
  const currency = d?.summary.currency ?? 'INR';

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Earnings</Text>

      <Card style={{ backgroundColor: t.brandSoft, borderColor: t.brand }}>
        <Text style={{ color: t.brandSoftFg, fontSize: 13 }}>Net earned</Text>
        <Text style={[styles.total, { color: t.brandSoftFg }]}>
          {formatMoney(d?.summary.net ?? 0, currency)}
        </Text>
      </Card>

      <View style={styles.stats}>
        <Stat label="Gross" value={formatMoney(d?.summary.gross ?? 0, currency)} />
        <Stat label="Platform fees" value={formatMoney(d?.summary.fees ?? 0, currency)} />
      </View>

      <Text style={[styles.sectionTitle, { color: t.fgStrong }]}>Settlements</Text>
      {d?.items?.length ? (
        <View style={{ gap: 12 }}>
          {d.items.map((e) => (
            <Card key={e.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.fgStrong, fontWeight: '700' }} numberOfLines={1}>
                    {e.listingTitle ?? e.bookingReference ?? 'Booking'}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>
                    {e.paidAt ? formatDate(e.paidAt) : 'Pending settlement'} · fee {formatMoney(e.platformFee, e.currency)}
                  </Text>
                </View>
                <Text style={{ color: t.fgStrong, fontWeight: '800' }}>{formatMoney(e.netAmount, e.currency)}</Text>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <Card>
          <Text style={{ color: t.muted }}>No earnings yet. Earnings appear here once bookings are paid.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  total: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderRadius: 16, padding: 16, gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 13 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
