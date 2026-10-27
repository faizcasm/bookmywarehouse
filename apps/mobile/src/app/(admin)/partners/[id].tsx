/**
 * Admin partner detail — full KYC profile: business details, account block,
 * submitted documents, listings summary, and approve/reject/suspend decisions.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  ErrorState,
  KeyValue,
  LoadingOverlay,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  TextField,
  type KeyValueItem,
  type SegmentedOption,
} from '@/components/ui';
import {
  decidePartner,
  getAdminPartner,
  type PartnerDecision,
} from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import {
  LISTING_STATUS_META,
  VERIFICATION_STATUS_META,
  formatDate,
  humanize,
  type StatusMeta,
} from '@/utils/format';

interface PartnerVerificationDoc {
  id: string;
  label: string;
  url: string;
  status: string;
  uploadedAt: string;
  rejectionReason?: string | null;
}

interface PartnerDetail {
  partnerId: string;
  userId: string;
  businessName: string;
  businessType?: string | null;
  description?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  verificationStatus: string;
  verification: {
    id: string;
    status: string;
    legalBusinessName?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
    registrationNumber?: string | null;
    documents: PartnerVerificationDoc[];
    submittedAt?: string | null;
    reviewedAt?: string | null;
    rejectionReason?: string | null;
    reviewerNotes?: string | null;
  } | null;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    status: string;
    emailVerified?: boolean;
  } | null;
  payout: {
    accountHolderName?: string;
    accountNumberMasked?: string;
    ifsc?: string;
    bankName?: string;
    upiId?: string;
  } | null;
  listings: { id: string; title: string; status?: string; city?: string }[];
  createdAt: string;
}

const DECISION_OPTIONS: SegmentedOption<PartnerDecision>[] = [
  { value: 'APPROVE', label: 'Approve' },
  { value: 'REJECT', label: 'Reject' },
  { value: 'SUSPEND', label: 'Suspend' },
];

const DECISION_COPY: Record<PartnerDecision, { button: string; success: string; danger: boolean }> = {
  APPROVE: { button: 'Approve partner', success: 'Partner approved and marked verified.', danger: false },
  REJECT: { button: 'Reject verification', success: 'Verification rejected — the partner was notified.', danger: true },
  SUSPEND: { button: 'Suspend partner', success: 'Partner suspended — their listings are no longer visible to buyers.', danger: true },
};

const USER_STATUS_META: Record<string, StatusMeta> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  DEACTIVATED: { label: 'Deactivated', tone: 'neutral' },
};

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function AdminPartnerDetailScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: sessionUser } = useSession();

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decision, setDecision] = useState<PartnerDecision>('APPROVE');
  const [note, setNote] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['admin-partner', id],
    queryFn: () => getAdminPartner(id!),
    enabled: !!id && !!sessionUser,
  });

  const decide = useMutation({
    mutationFn: ({ action, reason }: { action: PartnerDecision; reason?: string }) =>
      decidePartner(id!, action, reason),
    onSuccess: (_data, variables) => {
      setDecisionOpen(false);
      setNote('');
      setDecision('APPROVE');
      setSuccessMessage(
        variables.action === 'APPROVE'
          ? DECISION_COPY.APPROVE.success
          : variables.action === 'REJECT'
            ? DECISION_COPY.REJECT.success
            : DECISION_COPY.SUSPEND.success,
      );
      qc.invalidateQueries({ queryKey: ['admin-partner', id] });
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      qc.invalidateQueries({ queryKey: ['admin-verifications'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  if (!sessionUser) {
    return (
      <Screen>
        <Text style={[styles.guest, { color: t.muted }]}>
          Sign in with an administrator account to view this partner.
        </Text>
      </Screen>
    );
  }

  if (detail.isLoading) return <LoadingOverlay />;

  if (detail.isError || !detail.data) {
    return (
      <Screen>
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
        </View>
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      </Screen>
    );
  }

  const p = detail.data as unknown as PartnerDetail;
  const verifyMeta = VERIFICATION_STATUS_META[p.verificationStatus as keyof typeof VERIFICATION_STATUS_META];
  const userMeta = p.user ? USER_STATUS_META[p.user.status] : undefined;
  const verification = p.verification;
  const listings = p.listings ?? [];

  const profileItems: KeyValueItem[] = [
    { label: 'Business type', value: p.businessType ? humanize(p.businessType) : '—' },
    { label: 'Verification', value: <Badge label={verifyMeta?.label ?? humanize(p.verificationStatus)} tone={verifyMeta?.tone ?? 'neutral'} /> },
    { label: 'Joined', value: formatDate(p.createdAt) },
    ...(p.website ? [{ label: 'Website', value: p.website, block: true }] : []),
    ...(p.description ? [{ label: 'About', value: p.description, block: true }] : []),
  ];

  const payoutItems: KeyValueItem[] = p.payout
    ? [
        ...(p.payout.accountHolderName ? [{ label: 'Account holder', value: p.payout.accountHolderName }] : []),
        ...(p.payout.accountNumberMasked ? [{ label: 'Account', value: p.payout.accountNumberMasked }] : []),
        ...(p.payout.ifsc ? [{ label: 'IFSC', value: p.payout.ifsc }] : []),
        ...(p.payout.bankName ? [{ label: 'Bank', value: p.payout.bankName }] : []),
        ...(p.payout.upiId ? [{ label: 'UPI', value: p.payout.upiId }] : []),
      ]
    : [];

  const noteRequired = decision === 'REJECT' && note.trim().length === 0;
  const copy = DECISION_COPY[decision];

  return (
    <Screen scroll>
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
        <Text style={[styles.headerTitle, { color: t.fgStrong }]} numberOfLines={1}>
          {p.businessName || 'Partner'}
        </Text>
      </View>

      {successMessage ? (
        <Banner
          tone="success"
          message={successMessage}
          actionLabel="Dismiss"
          onAction={() => setSuccessMessage(null)}
        />
      ) : null}

      <Card style={styles.identity}>
        <Avatar uri={p.logoUrl ?? null} name={p.businessName || p.user?.name} size={56} />
        <View style={styles.identityText}>
          <Text style={[styles.businessName, { color: t.fgStrong }]} numberOfLines={2}>
            {p.businessName || 'Unnamed business'}
          </Text>
          {p.user ? (
            <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
              {p.user.name} · {p.user.email}
            </Text>
          ) : null}
        </View>
      </Card>

      <SectionHeader title="Business profile" />
      <Card>
        <KeyValue items={profileItems} />
      </Card>

      <SectionHeader title="Account" />
      <Card>
        {p.user ? (
          <KeyValue
            items={[
              { label: 'Name', value: p.user.name },
              { label: 'Email', value: p.user.email },
              ...(p.user.phone ? [{ label: 'Phone', value: p.user.phone }] : []),
              {
                label: 'Status',
                value: (
                  <Badge
                    label={userMeta?.label ?? humanize(p.user.status)}
                    tone={userMeta?.tone ?? 'neutral'}
                  />
                ),
              },
              {
                label: 'Email verified',
                value: p.user.emailVerified ? 'Yes' : 'No',
              },
            ]}
          />
        ) : (
          <Text style={[styles.meta, { color: t.muted }]}>No linked account found.</Text>
        )}
      </Card>

      {payoutItems.length ? (
        <>
          <SectionHeader title="Payout details" />
          <Card>
            <KeyValue items={payoutItems} />
          </Card>
        </>
      ) : null}

      <SectionHeader
        title="Verification"
        actionLabel="Open KYC queue"
        onAction={() => router.push('/(admin)/verifications' as never)}
      />
      <Card style={styles.sectionCard}>
        {verification ? (
          <>
            <KeyValue
              items={[
                {
                  label: 'Status',
                  value: (
                    <Badge
                      label={
                        VERIFICATION_STATUS_META[verification.status as keyof typeof VERIFICATION_STATUS_META]?.label ??
                        humanize(verification.status)
                      }
                      tone={
                        VERIFICATION_STATUS_META[verification.status as keyof typeof VERIFICATION_STATUS_META]?.tone ??
                        'neutral'
                      }
                    />
                  ),
                },
                { label: 'Submitted', value: formatDate(verification.submittedAt) },
                ...(verification.reviewedAt
                  ? [{ label: 'Reviewed', value: formatDate(verification.reviewedAt) }]
                  : []),
                ...(verification.legalBusinessName
                  ? [{ label: 'Legal name', value: verification.legalBusinessName }]
                  : []),
                ...(verification.gstNumber ? [{ label: 'GST', value: verification.gstNumber }] : []),
                ...(verification.panNumber ? [{ label: 'PAN', value: verification.panNumber }] : []),
                ...(verification.registrationNumber
                  ? [{ label: 'Registration', value: verification.registrationNumber }]
                  : []),
                ...(verification.rejectionReason
                  ? [{ label: 'Rejection reason', value: verification.rejectionReason, block: true }]
                  : []),
              ]}
            />
            <Text style={[styles.docsTitle, { color: t.fgStrong }]}>
              Documents ({verification.documents.length})
            </Text>
            {verification.documents.length === 0 ? (
              <Text style={[styles.meta, { color: t.muted }]}>No documents submitted yet.</Text>
            ) : (
              verification.documents.map((doc) => (
                <View key={doc.id} style={styles.docRow}>
                  <View style={styles.docText}>
                    <Text style={[styles.docLabel, { color: t.fg }]} numberOfLines={1}>
                      {doc.label}
                    </Text>
                    <Text style={[styles.meta, { color: t.faint }]}>
                      Uploaded {formatDate(doc.uploadedAt)}
                    </Text>
                  </View>
                  <Badge label={humanize(doc.status)} tone={doc.status === 'VERIFIED' ? 'success' : doc.status === 'REJECTED' ? 'danger' : 'neutral'} />
                </View>
              ))
            )}
          </>
        ) : (
          <Text style={[styles.meta, { color: t.muted }]}>
            This partner has not submitted verification documents yet.
          </Text>
        )}
      </Card>

      <SectionHeader title={`Listings (${listings.length})`} />
      <Card padded={false}>
        {listings.length === 0 ? (
          <Text style={[styles.emptyListing, { color: t.muted }]}>No listings published yet.</Text>
        ) : (
          listings.map((listing) => {
            const meta = LISTING_STATUS_META[listing.status as keyof typeof LISTING_STATUS_META];
            return (
              <View key={listing.id} style={styles.listingRow}>
                <View style={styles.listingText}>
                  <Text style={[styles.docLabel, { color: t.fg }]} numberOfLines={1}>
                    {listing.title}
                  </Text>
                  {listing.city ? (
                    <Text style={[styles.meta, { color: t.faint }]}>{listing.city}</Text>
                  ) : null}
                </View>
                <Badge label={meta?.label ?? humanize(listing.status ?? 'DRAFT')} tone={meta?.tone ?? 'neutral'} />
              </View>
            );
          })
        )}
      </Card>

      <SectionHeader title="Decision" />
      <Card style={styles.sectionCard}>
        <Text style={[styles.meta, { color: t.muted }]}>
          Approving marks the business verified and lets it publish listings. Rejections and
          suspensions notify the partner with your note.
        </Text>
        <View style={styles.decisionButtons}>
          <Button
            label="Approve"
            onPress={() => {
              setDecision('APPROVE');
              setNote('');
              decide.reset();
              setDecisionOpen(true);
            }}
          />
          <Button
            label="Review & reject"
            variant="secondary"
            onPress={() => {
              setDecision('REJECT');
              setNote('');
              decide.reset();
              setDecisionOpen(true);
            }}
          />
          <Button
            label="Suspend"
            variant="danger"
            onPress={() => {
              setDecision('SUSPEND');
              setNote('');
              decide.reset();
              setDecisionOpen(true);
            }}
          />
        </View>
      </Card>

      <Sheet
        visible={decisionOpen}
        onClose={() => setDecisionOpen(false)}
        title="Partner decision"
        subtitle={p.businessName || p.user?.name}
        dismissOnBackdrop={false}
        footer={
          <Button
            label={copy.button}
            variant={copy.danger ? 'danger' : 'primary'}
            fullWidth
            disabled={noteRequired}
            loading={decide.isPending}
            onPress={() =>
              decide.mutate({ action: decision, reason: note.trim() ? note.trim() : undefined })
            }
          />
        }
      >
        <Segmented options={DECISION_OPTIONS} value={decision} onChange={setDecision} />
        <TextField
          label={decision === 'REJECT' ? 'Reason (required)' : 'Note (optional)'}
          value={note}
          onChangeText={setNote}
          placeholder={
            decision === 'REJECT' ? 'What needs fixing before approval…' : 'Recorded with the decision'
          }
          multiline
          error={noteRequired ? 'A reason is required to reject this partner.' : undefined}
        />
        {decide.isError ? <Banner tone="danger" message={messageFor(decide.error)} /> : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800' },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  guest: { fontSize: 15, textAlign: 'center', paddingHorizontal: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityText: { flex: 1, gap: 2 },
  businessName: { fontSize: 18, fontWeight: '800' },
  meta: { fontSize: 13 },
  sectionCard: { gap: 12 },
  docsTitle: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000012',
  },
  docText: { flex: 1, gap: 2 },
  docLabel: { fontSize: 14.5, fontWeight: '600' },
  emptyListing: { paddingHorizontal: 16, paddingVertical: 16, fontSize: 14 },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listingText: { flex: 1, gap: 2 },
  decisionButtons: { gap: 8 },
});
