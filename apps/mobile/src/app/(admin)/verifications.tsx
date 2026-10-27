/**
 * Admin verifications — KYC review queue with approve / reject / suspend
 * decisions (partner decisions) behind a confirmation sheet.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { PaginatedList } from '@/components/PaginatedList';
import {
  Badge,
  Banner,
  Button,
  Card,
  Screen,
  Segmented,
  Sheet,
  SignInPrompt,
  TextField,
  type SegmentedOption,
} from '@/components/ui';
import {
  decidePartner,
  listAdminPartners,
  listVerifications,
  type AdminPartnerRow,
  type PartnerDecision,
} from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { VERIFICATION_STATUS_META, formatDate, humanize } from '@/utils/format';

const STATUS_OPTIONS: SegmentedOption[] = [
  { value: '', label: 'All' },
  { value: 'SUBMITTED', label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'In review' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const DECISION_OPTIONS: SegmentedOption<PartnerDecision>[] = [
  { value: 'APPROVE', label: 'Approve' },
  { value: 'REJECT', label: 'Reject' },
  { value: 'SUSPEND', label: 'Suspend' },
];

const ACTIONABLE = new Set(['SUBMITTED', 'UNDER_REVIEW']);

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function AdminVerificationsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { user } = useSession();

  const [status, setStatus] = useState('');
  const [target, setTarget] = useState<AdminPartnerRow | null>(null);
  const [decision, setDecision] = useState<PartnerDecision>('APPROVE');
  const [note, setNote] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-verifications'] });
    qc.invalidateQueries({ queryKey: ['admin-partners'] });
    qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const decide = useMutation({
    mutationFn: ({ partnerId, action, reason }: { partnerId: string; action: PartnerDecision; reason?: string }) =>
      decidePartner(partnerId, action, reason),
    onSuccess: (_data, variables) => {
      const name = target?.businessName || target?.user?.name || 'Partner';
      setTarget(null);
      setNote('');
      setDecision('APPROVE');
      setSuccessMessage(
        variables.action === 'APPROVE'
          ? `${name} is now verified.`
          : variables.action === 'REJECT'
            ? `Verification for ${name} was rejected.`
            : `${name} was suspended.`,
      );
      invalidate();
    },
  });

  const openDecision = (row: AdminPartnerRow) => {
    setTarget(row);
    setDecision('APPROVE');
    setNote('');
    decide.reset();
  };

  const closeSheet = () => {
    setTarget(null);
    setNote('');
    decide.reset();
  };

  const submitDecision = () => {
    if (!target) return;
    decide.mutate({
      partnerId: target.partnerId,
      action: decision,
      reason: note.trim() ? note.trim() : undefined,
    });
  };

  const noteRequired = decision === 'REJECT' && note.trim().length === 0;
  const sheetSubtitle = target ? target.businessName || target.user?.name || 'Partner' : undefined;

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to review verifications"
          subtitle="Verification decisions are restricted to platform administrators."
          next="/(admin)/verifications"
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, { backgroundColor: t.surface2 }, pressed && { opacity: 0.7 }]}
        >
          <ChevronLeft size={22} color={t.fg} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.heading, { color: t.fgStrong }]}>Verifications</Text>
          <Text style={[styles.subheading, { color: t.muted }]}>Partner KYC review queue</Text>
        </View>
      </View>

      {successMessage ? (
        <View style={styles.successWrap}>
          <Banner tone="success" message={successMessage} actionLabel="Dismiss" onAction={() => setSuccessMessage(null)} />
        </View>
      ) : null}

      <PaginatedList<AdminPartnerRow>
        queryKey={['admin-verifications', status]}
        fetchPage={(page) =>
          status
            ? listVerifications({ page, limit: 20, status })
            : // The queue endpoint defaults to `SUBMITTED` when no status is sent,
              // and empty query strings are dropped by the API client, so "All"
              // is served by the partners list with no verification filter.
              listAdminPartners({ page, limit: 20 })
        }
        keyExtractor={(v) => v.partnerId}
        emptyTitle="No verifications here"
        emptySubtitle="Partner verification submissions matching this filter will appear here."
        itemHeight={132}
        header={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} equalWidth={false} />
          </ScrollView>
        }
        renderItem={(v) => {
          const meta = VERIFICATION_STATUS_META[v.verificationStatus as keyof typeof VERIFICATION_STATUS_META];
          const name = v.businessName || v.user?.name || 'Partner';
          const actionable = ACTIONABLE.has(v.verificationStatus);
          const details = [
            v.businessType ? humanize(v.businessType) : 'Partner',
            v.city ?? null,
            `${v.listingCount ?? 0} listing${(v.listingCount ?? 0) === 1 ? '' : 's'}`,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <Card style={styles.rowCard} onPress={() => router.push(`/(admin)/partners/${v.partnerId}` as never)}>
              <View style={styles.rowTop}>
                <View style={styles.rowTitleWrap}>
                  <Text style={[styles.name, { color: t.fgStrong }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
                    {details}
                  </Text>
                  <Text style={[styles.meta, { color: t.faint }]}>
                    Submitted {formatDate(v.createdAt)}
                  </Text>
                </View>
                <Badge label={meta?.label ?? humanize(v.verificationStatus)} tone={meta?.tone ?? 'neutral'} />
              </View>
              {actionable ? (
                <Button
                  label="Review submission"
                  variant="secondary"
                  onPress={() => openDecision(v)}
                />
              ) : null}
            </Card>
          );
        }}
      />

      <Sheet
        visible={target !== null}
        onClose={closeSheet}
        title="Review verification"
        subtitle={sheetSubtitle}
        dismissOnBackdrop={false}
        footer={
          <Button
            label={
              decision === 'APPROVE'
                ? 'Approve partner'
                : decision === 'REJECT'
                  ? 'Reject verification'
                  : 'Suspend partner'
            }
            variant={decision === 'REJECT' ? 'danger' : 'primary'}
            fullWidth
            disabled={noteRequired}
            loading={decide.isPending}
            onPress={submitDecision}
          />
        }
      >
        <Segmented options={DECISION_OPTIONS} value={decision} onChange={setDecision} />
        <TextField
          label={decision === 'REJECT' ? 'Reason for rejection' : 'Reviewer note (optional)'}
          value={note}
          onChangeText={setNote}
          placeholder={
            decision === 'REJECT'
              ? 'Tell the partner what needs fixing…'
              : 'Anything the partner should know…'
          }
          multiline
          error={noteRequired ? 'A reason is required to reject a submission.' : undefined}
          hint={decision === 'REJECT' ? undefined : 'Stored with the review decision.'}
        />
        {decide.isError ? <Banner tone="danger" message={messageFor(decide.error)} /> : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  heading: { fontSize: 24, fontWeight: '800' },
  subheading: { fontSize: 13, marginTop: 2 },
  successWrap: { paddingHorizontal: 16, marginBottom: 12 },
  filters: { gap: 8, paddingVertical: 2 },
  rowCard: { gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitleWrap: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
});
