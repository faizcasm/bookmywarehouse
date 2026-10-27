/**
 * Admin payments — payments ledger and refund queue behind a segmented switch.
 * Pending refunds can be processed from a confirmation sheet (the endpoint
 * settles the stored amount, so no amount is collected here).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import {
  Badge,
  Banner,
  Button,
  Card,
  KeyValue,
  Screen,
  Segmented,
  Sheet,
  type KeyValueItem,
  type SegmentedOption,
} from '@/components/ui';
import {
  listAdminPayments,
  listAdminRefunds,
  processRefund,
  type AdminPaymentRow,
  type AdminRefundRow,
} from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { PAYMENT_STATUS_META, formatDate, formatMoney, humanize, type StatusMeta } from '@/utils/format';

const TAB_OPTIONS: SegmentedOption[] = [
  { value: 'payments', label: 'Payments' },
  { value: 'refunds', label: 'Refunds' },
];

const REFUND_STATUS_OPTIONS: SegmentedOption[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REJECTED', label: 'Rejected' },
];

const REFUND_STATUS_META: Record<string, StatusMeta> = {
  PENDING: { label: 'Pending', tone: 'warn' },
  PROCESSING: { label: 'Processing', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  REJECTED: { label: 'Rejected', tone: 'neutral' },
};

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function AdminPaymentsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { user } = useSession();

  const [tab, setTab] = useState<'payments' | 'refunds'>('payments');
  const [refundStatus, setRefundStatus] = useState('');
  const [target, setTarget] = useState<AdminRefundRow | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const process = useMutation({
    mutationFn: (refundId: string) => processRefund(refundId),
    onSuccess: () => {
      setTarget(null);
      setSuccessMessage('Refund processed — the customer will see it back on their original payment method.');
      qc.invalidateQueries({ queryKey: ['admin-refunds'] });
      qc.invalidateQueries({ queryKey: ['admin-payments'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const openConfirm = (row: AdminRefundRow) => {
    setTarget(row);
    process.reset();
  };

  if (!user) {
    return (
      <Screen scroll>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Payments</Text>
        <Banner tone="info" message="Sign in with an administrator account to view payments and refunds." />
      </Screen>
    );
  }

  const refundItems: KeyValueItem[] | null = target
    ? [
        { label: 'Amount', value: formatMoney(target.amountMinor ?? target.amount ?? 0, target.currency ?? 'INR') },
        { label: 'Status', value: humanize(target.status ?? 'PENDING') },
        { label: 'Requested', value: formatDate(target.createdAt) },
      ]
    : null;

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Payments</Text>

      <View style={styles.tabWrap}>
        <Segmented options={TAB_OPTIONS} value={tab} onChange={(next) => setTab(next as 'payments' | 'refunds')} />
      </View>

      {successMessage ? (
        <View style={styles.successWrap}>
          <Banner tone="success" message={successMessage} actionLabel="Dismiss" onAction={() => setSuccessMessage(null)} />
        </View>
      ) : null}

      {tab === 'payments' ? (
        <PaginatedList<AdminPaymentRow>
          queryKey={['admin-payments']}
          fetchPage={(page) => listAdminPayments({ page, limit: 20 })}
          keyExtractor={(p) => p.id}
          emptyTitle="No payments yet"
          emptySubtitle="Captured and failed payments will appear here."
          itemHeight={110}
          renderItem={(p) => {
            const meta = PAYMENT_STATUS_META[p.status as keyof typeof PAYMENT_STATUS_META];
            return (
              <Card style={styles.card}>
                <View style={styles.rowTop}>
                  <View style={styles.rowText}>
                    <Text style={[styles.amount, { color: t.fgStrong }]}>
                      {formatMoney(p.amount ?? 0, p.currency ?? 'INR')}
                    </Text>
                    <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
                      {p.reference ? `Booking ${p.reference}` : p.id}
                    </Text>
                    <Text style={[styles.meta, { color: t.faint }]}>
                      {p.provider ?? 'Provider'} · {formatDate(p.createdAt)}
                    </Text>
                  </View>
                  <Badge label={meta?.label ?? humanize(p.status ?? 'UNKNOWN')} tone={meta?.tone ?? 'neutral'} />
                </View>
              </Card>
            );
          }}
        />
      ) : (
        <PaginatedList<AdminRefundRow>
          queryKey={['admin-refunds', refundStatus]}
          fetchPage={(page) =>
            listAdminRefunds(refundStatus ? { page, limit: 20, status: refundStatus } : { page, limit: 20 })
          }
          keyExtractor={(r) => r.id}
          emptyTitle="No refunds here"
          emptySubtitle="Refund requests matching this filter will appear here."
          itemHeight={150}
          header={
            <View style={styles.filterWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                <Segmented
                  options={REFUND_STATUS_OPTIONS}
                  value={refundStatus}
                  onChange={setRefundStatus}
                  equalWidth={false}
                />
              </ScrollView>
            </View>
          }
          renderItem={(r) => {
            const meta = REFUND_STATUS_META[r.status ?? ''];
            const pending = r.status === 'PENDING';
            return (
              <Card style={styles.card}>
                <View style={styles.rowTop}>
                  <View style={styles.rowText}>
                    <Text style={[styles.amount, { color: t.fgStrong }]}>
                      {formatMoney(r.amountMinor ?? r.amount ?? 0, r.currency ?? 'INR')}
                    </Text>
                    <Text style={[styles.meta, { color: t.muted }]}>Requested {formatDate(r.createdAt)}</Text>
                  </View>
                  <Badge label={meta?.label ?? humanize(r.status ?? 'PENDING')} tone={meta?.tone ?? 'neutral'} />
                </View>
                {pending ? (
                  <Button label="Process refund" variant="secondary" onPress={() => openConfirm(r)} />
                ) : null}
              </Card>
            );
          }}
        />
      )}

      <Sheet
        visible={target !== null}
        onClose={() => setTarget(null)}
        title="Process refund"
        subtitle="Confirm this refund"
        dismissOnBackdrop={false}
        footer={
          <Button
            label="Confirm refund"
            fullWidth
            loading={process.isPending}
            onPress={() => {
              if (target) process.mutate(target.id);
            }}
          />
        }
      >
        <Text style={[styles.sheetCopy, { color: t.muted }]}>
          The stored refund amount will be settled to the customer now. This cannot be undone.
        </Text>
        {refundItems ? <KeyValue items={refundItems} /> : null}
        {process.isError ? <Banner tone="danger" message={messageFor(process.error)} /> : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  heading: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16 },
  tabWrap: { paddingHorizontal: 16, marginBottom: 12 },
  successWrap: { paddingHorizontal: 16, marginBottom: 12 },
  filterWrap: { marginBottom: 4 },
  filters: { gap: 8, paddingVertical: 2 },
  card: { gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowText: { flex: 1, gap: 2 },
  amount: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  sheetCopy: { fontSize: 13.5, lineHeight: 19 },
});
