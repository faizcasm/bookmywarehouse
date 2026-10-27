/**
 * Invoices — the customer's invoices with status, total and PDF print/share.
 * The invoice HTML is rendered server-side and turned into a PDF with
 * expo-print, then shared natively (or printed directly as a fallback).
 */

import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Button, Card, Screen, SignInPrompt, type BadgeTone } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { listInvoices, getInvoiceHtml } from '@/services/api/payments';
import { formatDate, formatMoney } from '@/utils/format';
import type { Invoice } from '@/types';

function invoiceTone(status: string): BadgeTone {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'ISSUED':
    case 'PENDING':
    case 'DUE':
    case 'OVERDUE':
      return 'warn';
    case 'VOID':
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function InvoicesScreen() {
  const t = useTheme();
  const { user } = useSession();
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Render the server-side invoice HTML to PDF, then print / share it. */
  const shareInvoice = async (inv: Invoice) => {
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

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to see your invoices"
          subtitle="Tax invoices for every booking live here, ready to download."
          next="/(customer)/invoices"
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <PaginatedList<Invoice>
        queryKey={['invoices']}
        fetchPage={(page) => listInvoices({ page })}
        keyExtractor={(inv) => inv.id}
        itemHeight={132}
        emptyTitle="No invoices yet"
        emptySubtitle="Invoices for your bookings will appear here."
        header={
          <View style={styles.header}>
            <Text style={[styles.heading, { color: t.fgStrong }]}>Invoices</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>
              Download a PDF copy of any invoice to expense or file it.
            </Text>
          </View>
        }
        renderItem={(inv) => (
          <Card
            onPress={inv.bookingId ? () => router.push(`/(customer)/booking/${inv.bookingId}`) : undefined}
          >
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.number, { color: t.fgStrong }]} numberOfLines={1}>
                  {inv.invoiceNumber}
                </Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>
                  Issued {formatDate(inv.issuedAt ?? inv.createdAt)}
                </Text>
              </View>
              <Badge label={humanizeStatus(inv.status)} tone={invoiceTone(inv.status)} />
            </View>
            <View style={styles.bottom}>
              <Text style={[styles.total, { color: t.fgStrong }]}>
                {formatMoney(inv.totalMinor, inv.currency)}
              </Text>
              <Button
                label="PDF"
                variant="secondary"
                onPress={() => shareInvoice(inv)}
                loading={busyId === inv.id}
                style={styles.pdfButton}
              />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

function humanizeStatus(status: string): string {
  const spaced = status.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: { gap: 2 },
  heading: { fontSize: 22, fontWeight: '800' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  number: { fontSize: 16, fontWeight: '700' },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  total: { fontSize: 18, fontWeight: '800' },
  pdfButton: { minHeight: 40, paddingHorizontal: 16 },
});
