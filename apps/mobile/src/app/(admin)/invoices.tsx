/**
 * Admin invoices — platform invoice ledger with a status filter. Invoices are
 * read-only from the admin console (issuance happens on booking completion).
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Banner, Card, Screen, Segmented, type SegmentedOption } from '@/components/ui';
import { listAdminInvoices, type AdminInvoiceRow } from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { formatDate, formatMoney, humanize, type StatusMeta } from '@/utils/format';

const STATUS_OPTIONS: SegmentedOption[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'PAID', label: 'Paid' },
  { value: 'VOID', label: 'Void' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const INVOICE_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  ISSUED: { label: 'Issued', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  VOID: { label: 'Void', tone: 'danger' },
  REFUNDED: { label: 'Refunded', tone: 'warn' },
};

export default function AdminInvoicesScreen() {
  const t = useTheme();
  const { user } = useSession();
  const [status, setStatus] = useState('');

  if (!user) {
    return (
      <Screen scroll>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Invoices</Text>
        <Banner tone="info" message="Sign in with an administrator account to view invoices." />
      </Screen>
    );
  }

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Invoices</Text>
      <PaginatedList<AdminInvoiceRow>
        queryKey={['admin-invoices', status]}
        // The endpoint validates only pagination and ignores `status`, so the
        // filter is applied per page client-side (mirrors the reviews screen).
        fetchPage={async (page) => {
          const res = await listAdminInvoices({ page, limit: 20 });
          if (!status) return res;
          return { ...res, items: res.items.filter((i) => i.status === status) };
        }}
        keyExtractor={(i) => i.id}
        emptyTitle="No invoices here"
        emptySubtitle="Invoices matching this filter will appear here once bookings complete."
        itemHeight={120}
        header={
          <View style={styles.filterWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} equalWidth={false} />
            </ScrollView>
          </View>
        }
        renderItem={(i) => {
          const meta = INVOICE_STATUS_META[i.status ?? ''];
          return (
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={[styles.number, { color: t.fgStrong }]} numberOfLines={1}>
                    {i.invoiceNumber ?? i.id}
                  </Text>
                  <Text style={[styles.meta, { color: t.muted }]}>
                    {formatMoney(i.total ?? 0, i.currency ?? 'INR')} · {formatDate(i.createdAt)}
                  </Text>
                </View>
                <Badge label={meta?.label ?? humanize(i.status ?? 'DRAFT')} tone={meta?.tone ?? 'neutral'} />
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
  filterWrap: { marginBottom: 4 },
  filters: { gap: 8, paddingVertical: 2 },
  card: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { flex: 1, gap: 2 },
  number: { fontSize: 15.5, fontWeight: '700' },
  meta: { fontSize: 13 },
});
