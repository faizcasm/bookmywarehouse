/** Invoices — the customer's invoices with print + native share. */

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Button, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listInvoices, getInvoiceHtml } from '@/services/api/payments';
import { formatDate, formatMoney } from '@/utils/format';
import type { Invoice } from '@/types';

export default function InvoicesScreen() {
  const t = useTheme();
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Render the server-side invoice HTML to PDF, then print / share it. */
  const openInvoice = async (inv: Invoice) => {
    setBusyId(inv.id);
    try {
      const html = await getInvoiceHtml(inv.id);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice ${inv.invoiceNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (err) {
      Alert.alert('Could not open invoice', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusyId(null);
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
              <Button
                label="View / share"
                variant="ghost"
                onPress={() => openInvoice(inv)}
                loading={busyId === inv.id}
              />
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
