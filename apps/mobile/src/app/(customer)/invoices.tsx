/** Invoices — the customer's invoices with a share action. */

import React from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Button, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listInvoices } from '@/services/api/payments';
import { formatDate, formatMoney } from '@/utils/format';
import type { Invoice } from '@/types';

export default function InvoicesScreen() {
  const t = useTheme();

  const share = async (number: string) => {
    try {
      await Share.share({ message: `Invoice ${number}`, title: `Invoice ${number}` });
    } catch {
      // Sharing is best-effort; ignore failures.
    }
  };

  return (
    <Screen padTop={false} style={styles.screen}>
      <PaginatedList<Invoice>
        queryKey={['invoices']}
        fetchPage={(page) => listInvoices({ page })}
        keyExtractor={(inv) => inv.id}
        emptyTitle="No invoices yet"
        emptySubtitle="Invoices for your bookings will appear here."
        itemHeight={110}
        renderItem={(inv) => (
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.number, { color: t.fgStrong }]}>{inv.invoiceNumber}</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>{formatDate(inv.issuedAt ?? inv.createdAt)}</Text>
              </View>
              <Badge label={inv.status} tone={inv.status === 'PAID' ? 'success' : 'neutral'} />
            </View>
            <View style={styles.bottom}>
              <Text style={[styles.total, { color: t.fgStrong }]}>{formatMoney(inv.totalMinor, inv.currency)}</Text>
              <Button label="Share" variant="ghost" onPress={() => share(inv.invoiceNumber)} />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  number: { fontSize: 16, fontWeight: '700' },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  total: { fontSize: 18, fontWeight: '800' },
});
