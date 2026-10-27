/**
 * Payments — the customer's payment history (single-page endpoint).
 *
 * Rendered through PaginatedList so pull-to-refresh, skeletons and the empty
 * state match every other list in the app; the endpoint returns no meta, so
 * the list is capped at the one page the API serves (up to 50 rows).
 */

import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Card, Screen, SignInPrompt } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { listMyPayments } from '@/services/api/payments';
import { formatDateTime, formatMoney, shortenId, PAYMENT_STATUS_META } from '@/utils/format';
import type { Payment } from '@/types';

export default function PaymentsScreen() {
  const t = useTheme();
  const { user } = useSession();

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to see your payments"
          subtitle="Every payment you've made on BookMyWarehouse is listed here."
          next="/(customer)/payments"
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <PaginatedList<Payment>
        queryKey={['my-payments']}
        fetchPage={async () => ({ items: await listMyPayments() })}
        keyExtractor={(p) => p.id}
        itemHeight={104}
        emptyTitle="No payments yet"
        emptySubtitle="Payments you make for bookings will appear here."
        header={
          <View style={styles.header}>
            <Text style={[styles.heading, { color: t.fgStrong }]}>Payments</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>
              Your payment history, newest first.
            </Text>
          </View>
        }
        renderItem={(payment) => (
          <PaymentRow payment={payment} />
        )}
      />
    </Screen>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const t = useTheme();
  const meta = PAYMENT_STATUS_META[payment.status];

  return (
    <Card
      onPress={
        payment.bookingId
          ? () => router.push(`/(customer)/booking/${payment.bookingId}`)
          : undefined
      }
    >
      <View style={styles.rowTop}>
        <Text style={[styles.amount, { color: t.fgStrong }]}>
          {formatMoney(payment.amountMinor, payment.currency)}
        </Text>
        <Badge label={meta?.label ?? payment.status} tone={meta?.tone ?? 'neutral'} />
      </View>
      <View style={styles.meta}>
        {payment.provider ? (
          <Text style={{ color: t.muted, fontSize: 13 }}>{payment.provider}</Text>
        ) : null}
        <Text style={{ color: t.faint, fontSize: 12.5 }}>
          {formatDateTime(payment.createdAt)}
        </Text>
      </View>
      {payment.bookingId ? (
        <Text style={[styles.booking, { color: t.muted }]}>
          Booking {shortenId(payment.bookingId)}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: { gap: 2 },
  heading: { fontSize: 22, fontWeight: '800' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  amount: { fontSize: 18, fontWeight: '800' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  booking: { fontSize: 12.5, marginTop: 4 },
});
