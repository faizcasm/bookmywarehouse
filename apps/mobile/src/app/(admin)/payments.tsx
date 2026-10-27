/** Admin payments — payment list. */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAdminPayments, type AdminPaymentRow } from '@/services/api/admin';
import { formatMoney, formatDate, PAYMENT_STATUS_META } from '@/utils/format';

export default function AdminPaymentsScreen() {
  const t = useTheme();

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Payments</Text>
      <PaginatedList<AdminPaymentRow>
        queryKey={['admin-payments']}
        fetchPage={(page) => listAdminPayments({ page, limit: 20 })}
        keyExtractor={(p) => p.id}
        emptyTitle="No payments"
        emptySubtitle="Processed payments will appear here."
        itemHeight={120}
        renderItem={(p) => {
          const meta = PAYMENT_STATUS_META[p.status as keyof typeof PAYMENT_STATUS_META];
          return (
            <Card style={{ gap: 6 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.amount, { color: t.fgStrong }]}>
                    {formatMoney(p.amount ?? 0, p.currency ?? 'INR')}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>
                    {p.provider ?? 'provider'} · {formatDate(p.createdAt)}
                  </Text>
                </View>
                <Badge label={meta?.label ?? p.status} tone={meta?.tone ?? 'neutral'} />
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  heading: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { fontSize: 16, fontWeight: '700' },
});
