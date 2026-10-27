/**
 * Admin listings — moderation queue (approve / reject / suspend / restore)
 * with status filters, search, and per-row decisions in a sheet.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
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
  SignInPrompt,
  TextField,
  type SegmentedOption,
} from '@/components/ui';
import {
  listAdminListings,
  moderateListing,
  type AdminListingRow,
  type ListingModerationDecision,
} from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { LISTING_STATUS_META, formatDate, formatMoney, humanize } from '@/utils/format';

/** The admin listings payload also carries the owning partner summary. */
interface ListingRow extends AdminListingRow {
  partner?: { businessName?: string; verified?: boolean } | null;
}

const STATUS_OPTIONS: SegmentedOption[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'UNPUBLISHED', label: 'Unpublished' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const DECISION_LABEL: Record<ListingModerationDecision, string> = {
  APPROVE: 'Approve',
  REJECT: 'Reject',
  SUSPEND: 'Suspend',
  UNSUSPEND: 'Restore',
};

const DECISION_RESULT: Record<ListingModerationDecision, string> = {
  APPROVE: 'approved and published',
  REJECT: 'rejected',
  SUSPEND: 'suspended',
  UNSUSPEND: 'restored',
};

/** Decisions that make sense for the listing's current status. */
function decisionsFor(status: string): ListingModerationDecision[] {
  if (status === 'PUBLISHED') return ['SUSPEND', 'REJECT'];
  if (status === 'SUSPENDED' || status === 'REJECTED') return ['UNSUSPEND'];
  if (status === 'ARCHIVED') return ['APPROVE'];
  return ['APPROVE', 'REJECT'];
}

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function AdminListingsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { user } = useSession();

  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [target, setTarget] = useState<ListingRow | null>(null);
  const [decision, setDecision] = useState<ListingModerationDecision>('APPROVE');
  const [reason, setReason] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Debounce keystrokes into the query key without ever blocking typing.
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(value.trim()), 300);
  };

  const moderate = useMutation({
    mutationFn: ({ id, action, why }: { id: string; action: ListingModerationDecision; why?: string }) =>
      moderateListing(id, action, why),
    onSuccess: (_data, variables) => {
      const title = target?.title ?? 'Listing';
      setTarget(null);
      setReason('');
      setSuccessMessage(`"${title}" was ${DECISION_RESULT[variables.action]}.`);
      qc.invalidateQueries({ queryKey: ['admin-listings'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const openActions = (row: ListingRow) => {
    const options = decisionsFor(row.status ?? 'DRAFT');
    setTarget(row);
    setDecision(options[0] ?? 'APPROVE');
    setReason('');
    moderate.reset();
  };

  const closeSheet = () => {
    setTarget(null);
    setReason('');
    moderate.reset();
  };

  const targetStatus = target?.status ?? 'DRAFT';
  const available = decisionsFor(targetStatus);
  const reasonRequired = decision === 'REJECT' && reason.trim().length === 0;

  const submit = () => {
    if (!target || !target.id) return;
    moderate.mutate({
      id: target.id,
      action: decision,
      why: reason.trim() ? reason.trim() : undefined,
    });
  };

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to moderate listings"
          subtitle="Listing moderation is restricted to platform administrators."
          next="/(admin)/(tabs)/listings"
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Listings</Text>
        <Text style={[styles.subheading, { color: t.muted }]}>
          Review, publish and suspend listings across the marketplace.
        </Text>
      </View>

      {successMessage ? (
        <View style={styles.successWrap}>
          <Banner tone="success" message={successMessage} actionLabel="Dismiss" onAction={() => setSuccessMessage(null)} />
        </View>
      ) : null}

      <PaginatedList<ListingRow>
        queryKey={['admin-listings', status, search]}
        fetchPage={(page) =>
          listAdminListings({
            page,
            limit: 20,
            status: status || undefined,
            q: search || undefined,
          }).then((result) => ({ ...result, items: result.items as ListingRow[] }))
        }
        keyExtractor={(l) => l.id}
        emptyTitle="No listings found"
        emptySubtitle="Try a different status or search term."
        itemHeight={140}
        header={
          <View style={styles.filters}>
            <TextField
              label="Search listings"
              value={searchInput}
              onChangeText={onSearchChange}
              placeholder="Title or city"
              autoCapitalize="none"
              returnKeyType="search"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
              <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} equalWidth={false} />
            </ScrollView>
          </View>
        }
        renderItem={(l) => {
          const meta = LISTING_STATUS_META[l.status as keyof typeof LISTING_STATUS_META];
          return (
            <Card style={styles.rowCard} onPress={() => openActions(l)}>
              <View style={styles.rowTop}>
                <View style={styles.rowTitleWrap}>
                  <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={2}>
                    {l.title ?? 'Untitled listing'}
                  </Text>
                  <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
                    {[l.partner?.businessName, l.city].filter(Boolean).join(' · ') || humanize(l.type ?? '')}
                  </Text>
                  <Text style={[styles.meta, { color: t.faint }]}>
                    {humanize(l.type ?? '')}
                    {l.createdAt ? ` · listed ${formatDate(l.createdAt)}` : ''}
                  </Text>
                </View>
                <Badge label={meta?.label ?? humanize(l.status ?? 'DRAFT')} tone={meta?.tone ?? 'neutral'} />
              </View>
              <View style={styles.rowBottom}>
                <Text style={[styles.price, { color: t.fgStrong }]}>
                  {l.price?.amount != null ? formatMoney(l.price.amount, l.price.currency ?? 'INR') : 'Price not set'}
                </Text>
                <Text style={[styles.manage, { color: t.brand }]}>Manage</Text>
              </View>
            </Card>
          );
        }}
      />

      <Sheet
        visible={target !== null}
        onClose={closeSheet}
        title={target?.title ?? 'Listing actions'}
        subtitle={
          target
            ? [target.partner?.businessName, target.city, LISTING_STATUS_META[targetStatus as keyof typeof LISTING_STATUS_META]?.label ?? humanize(targetStatus)]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        dismissOnBackdrop={false}
        footer={
          <Button
            label={`${DECISION_LABEL[decision]} listing`}
            variant={decision === 'REJECT' || decision === 'SUSPEND' ? 'danger' : 'primary'}
            fullWidth
            disabled={reasonRequired}
            loading={moderate.isPending}
            onPress={submit}
          />
        }
      >
        {available.length > 1 ? (
          <Segmented
            options={available.map((value) => ({ value, label: DECISION_LABEL[value] }))}
            value={decision}
            onChange={setDecision}
          />
        ) : (
          <Text style={[styles.singleAction, { color: t.muted }]}>
            Only one action is available for this listing: {DECISION_LABEL[available[0] ?? 'APPROVE']}.
          </Text>
        )}
        <TextField
          label={decision === 'REJECT' ? 'Reason (required)' : 'Reason (optional)'}
          value={reason}
          onChangeText={setReason}
          placeholder={
            decision === 'REJECT'
              ? 'Explain what the partner needs to fix…'
              : 'Recorded with the moderation action'
          }
          multiline
          error={reasonRequired ? 'A reason is required to reject a listing.' : undefined}
        />
        {moderate.isError ? <Banner tone="danger" message={messageFor(moderate.error)} /> : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 12, gap: 2 },
  heading: { fontSize: 24, fontWeight: '800' },
  subheading: { fontSize: 13 },
  successWrap: { paddingHorizontal: 16, marginBottom: 12 },
  filters: { gap: 12 },
  statusRow: { gap: 8, paddingVertical: 2 },
  rowCard: { gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitleWrap: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: 15, fontWeight: '700' },
  manage: { fontSize: 13, fontWeight: '700' },
  singleAction: { fontSize: 13.5 },
});
