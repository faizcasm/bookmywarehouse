/**
 * Admin disputes — case queue with a resolve sheet: outcome, refund amount
 * (major-unit input converted to minor) and a required resolution note.
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
  Screen,
  Segmented,
  Sheet,
  TextField,
  type SegmentedOption,
} from '@/components/ui';
import {
  listAdminDisputes,
  resolveDispute,
  type AdminDisputeRow,
  type DisputeResolution,
} from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { formatDate, humanize, type StatusMeta } from '@/utils/format';

const STATUS_OPTIONS: SegmentedOption[] = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'UNDER_REVIEW', label: 'In review' },
  { value: 'RESOLVED_CUSTOMER', label: 'For customer' },
  { value: 'RESOLVED_PARTNER', label: 'For partner' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

const RESOLUTION_OPTIONS: SegmentedOption<DisputeResolution>[] = [
  { value: 'RESOLVED_CUSTOMER', label: 'For customer' },
  { value: 'RESOLVED_PARTNER', label: 'For partner' },
  { value: 'CLOSED', label: 'Close' },
];

const DISPUTE_STATUS_META: Record<string, StatusMeta> = {
  OPEN: { label: 'Open', tone: 'warn' },
  UNDER_REVIEW: { label: 'In review', tone: 'info' },
  RESOLVED_CUSTOMER: { label: 'Resolved · customer', tone: 'success' },
  RESOLVED_PARTNER: { label: 'Resolved · partner', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
};

const NOTE_MIN = 5;
const RESOLVABLE = new Set(['OPEN', 'UNDER_REVIEW']);

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function AdminDisputesScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { user } = useSession();

  const [status, setStatus] = useState('');
  const [target, setTarget] = useState<AdminDisputeRow | null>(null);
  const [resolution, setResolution] = useState<DisputeResolution>('RESOLVED_CUSTOMER');
  const [note, setNote] = useState('');
  const [refundMajor, setRefundMajor] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refundAmount = Number(refundMajor);
  const refundValid =
    refundMajor.trim() === '' || (Number.isFinite(refundAmount) && refundAmount >= 0);
  const noteValid = note.trim().length >= NOTE_MIN;
  const refundEnabled = resolution === 'RESOLVED_CUSTOMER';

  const resolve = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      resolveDispute(
        id,
        resolution,
        note.trim(),
        // The API takes the refund in minor units; the field collects major.
        refundEnabled && refundMajor.trim() !== '' && Number.isFinite(refundAmount)
          ? Math.round(refundAmount * 100)
          : undefined,
      ),
    onSuccess: () => {
      setTarget(null);
      setNote('');
      setRefundMajor('');
      setResolution('RESOLVED_CUSTOMER');
      setSuccessMessage('Dispute resolved — the customer has been notified.');
      qc.invalidateQueries({ queryKey: ['admin-disputes'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
    },
  });

  const openResolve = (row: AdminDisputeRow) => {
    setTarget(row);
    setResolution('RESOLVED_CUSTOMER');
    setNote('');
    setRefundMajor('');
    resolve.reset();
  };

  if (!user) {
    return (
      <Screen scroll>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Disputes</Text>
        <Banner tone="info" message="Sign in with an administrator account to review disputes." />
      </Screen>
    );
  }

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Disputes</Text>

      {successMessage ? (
        <View style={styles.successWrap}>
          <Banner tone="success" message={successMessage} actionLabel="Dismiss" onAction={() => setSuccessMessage(null)} />
        </View>
      ) : null}

      <PaginatedList<AdminDisputeRow>
        queryKey={['admin-disputes', status]}
        fetchPage={(page) =>
          status
            ? listAdminDisputes({ page, limit: 20, status })
            : listAdminDisputes({ page, limit: 20 })
        }
        keyExtractor={(d) => d.id}
        emptyTitle="No disputes here"
        emptySubtitle="Disputes matching this filter will appear here."
        itemHeight={160}
        header={
          <View style={styles.filterWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} equalWidth={false} />
            </ScrollView>
          </View>
        }
        renderItem={(d) => {
          const meta = DISPUTE_STATUS_META[d.status ?? 'OPEN'];
          const resolvable = RESOLVABLE.has(d.status ?? 'OPEN');
          return (
            <Card style={styles.card}>
              <View style={styles.rowTop}>
                <View style={styles.rowText}>
                  <Text style={[styles.reason, { color: t.fgStrong }]} numberOfLines={2}>
                    {humanize(d.reason ?? 'Dispute')}
                  </Text>
                  <Text style={[styles.meta, { color: t.muted }]}>
                    {d.bookingId ? `Booking ${d.bookingId}` : d.id}
                  </Text>
                  <Text style={[styles.meta, { color: t.faint }]}>Opened {formatDate(d.createdAt)}</Text>
                </View>
                <Badge label={meta?.label ?? humanize(d.status ?? 'OPEN')} tone={meta?.tone ?? 'neutral'} />
              </View>
              {resolvable ? (
                <Button label="Resolve dispute" variant="secondary" onPress={() => openResolve(d)} />
              ) : null}
            </Card>
          );
        }}
      />

      <Sheet
        visible={target !== null}
        onClose={() => setTarget(null)}
        title="Resolve dispute"
        subtitle={target?.bookingId ? `Booking ${target.bookingId}` : undefined}
        dismissOnBackdrop={false}
        footer={
          <Button
            label="Resolve dispute"
            fullWidth
            disabled={!noteValid || !refundValid}
            loading={resolve.isPending}
            onPress={() => resolve.mutate({ id: target!.id })}
          />
        }
      >
        <Segmented options={RESOLUTION_OPTIONS} value={resolution} onChange={setResolution} />
        <TextField
          label="Resolution note"
          value={note}
          onChangeText={setNote}
          placeholder="Explain the outcome for both parties…"
          multiline
          hint={`At least ${NOTE_MIN} characters — sent to the customer.`}
          error={note.length > 0 && !noteValid ? `At least ${NOTE_MIN} characters.` : undefined}
        />
        {refundEnabled ? (
          <TextField
            label="Refund to customer (optional)"
            value={refundMajor}
            onChangeText={setRefundMajor}
            placeholder="0"
            keyboardType="decimal-pad"
            hint="Settled immediately when the dispute resolves."
            error={!refundValid ? 'Enter a valid amount.' : undefined}
          />
        ) : null}
        {resolve.isError ? <Banner tone="danger" message={messageFor(resolve.error)} /> : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  heading: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16 },
  successWrap: { marginBottom: 12 },
  filterWrap: { marginBottom: 4 },
  filters: { gap: 8, paddingVertical: 2 },
  card: { gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowText: { flex: 1, gap: 2 },
  reason: { fontSize: 15.5, fontWeight: '700' },
  meta: { fontSize: 13 },
});
