/** Partner earnings — totals + payout history. */

import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getEarnings } from '@/services/api/partner';
import { formatMoney, formatDate } from '@/utils/format';

export default function EarningsScreen() {
  const t = useTheme();

  const earnings = useQuery({ queryKey: ['earnings'], queryFn: getEarnings });

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

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Earnings</Text>

      <Card style={{ backgroundColor: t.brandSoft, borderColor: t.brand }}>
        <Text style={{ color: t.brandSoftFg, fontSize: 13 }}>Total earned</Text>
        <Text style={[styles.total, { color: t.brandSoftFg }]}>
          {formatMoney(d?.totalEarningsMinor ?? 0, d?.currency ?? 'INR')}
        </Text>
      </Card>

      <Text style={[styles.sectionTitle, { color: t.fgStrong }]}>Payouts</Text>
      {d?.payouts?.length ? (
        <View style={{ gap: 12 }}>
          {d.payouts.map((p) => (
            <Card key={p.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.fgStrong, fontWeight: '700' }}>
                    {formatMoney(p.amountMinor, p.currency)}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>{formatDate(p.createdAt)}</Text>
                </View>
                <Badge
                  label={p.status}
                  tone={p.status === 'PAID' ? 'success' : p.status === 'FAILED' ? 'danger' : 'neutral'}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <Card>
          <Text style={{ color: t.muted }}>No payouts yet. Payouts are issued on your settlement cycle.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  total: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
