/**
 * Admin reviews — moderation queue: publish / hide / remove with an optional
 * note behind a confirmation sheet.
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
  StarRating,
  TextField,
  type SegmentedOption,
} from '@/components/ui';
import {
  listAdminReviews,
  moderateReview,
  type ReviewModerationStatus,
} from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { formatDate, humanize, type StatusMeta } from '@/utils/format';
import type { Review } from '@/types';

const STATUS_OPTIONS: SegmentedOption[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'HIDDEN', label: 'Hidden' },
  { value: 'REMOVED', label: 'Removed' },
];

const MODERATION_OPTIONS: SegmentedOption<ReviewModerationStatus>[] = [
  { value: 'PUBLISHED', label: 'Publish' },
  { value: 'HIDDEN', label: 'Hide' },
  { value: 'REMOVED', label: 'Remove' },
];

const REVIEW_STATUS_META: Record<string, StatusMeta> = {
  PENDING: { label: 'Pending', tone: 'warn' },
  PUBLISHED: { label: 'Published', tone: 'success' },
  HIDDEN: { label: 'Hidden', tone: 'neutral' },
  REMOVED: { label: 'Removed', tone: 'danger' },
};

const MODERATION_COPY: Record<ReviewModerationStatus, { button: string; success: string; danger: boolean }> = {
  PUBLISHED: { button: 'Publish review', success: 'Review is now public.', danger: false },
  HIDDEN: { button: 'Hide review', success: 'Review hidden from buyers.', danger: false },
  REMOVED: { button: 'Remove review', success: 'Review removed.', danger: true },
};

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function AdminReviewsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { user } = useSession();

  const [status, setStatus] = useState('');
  const [target, setTarget] = useState<Review | null>(null);
  const [moderation, setModeration] = useState<ReviewModerationStatus>('HIDDEN');
  const [note, setNote] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const moderate = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ReviewModerationStatus }) =>
      moderateReview(id, next, note.trim() ? note.trim() : undefined),
    onSuccess: (_data, variables) => {
      setTarget(null);
      setNote('');
      setSuccessMessage(MODERATION_COPY[variables.next].success);
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const openModeration = (review: Review) => {
    setTarget(review);
    setModeration(review.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED');
    setNote('');
    moderate.reset();
  };

  const copy = MODERATION_COPY[moderation];

  if (!user) {
    return (
      <Screen scroll>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Reviews</Text>
        <Banner tone="info" message="Sign in with an administrator account to moderate reviews." />
      </Screen>
    );
  }

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Reviews</Text>

      {successMessage ? (
        <View style={styles.successWrap}>
          <Banner tone="success" message={successMessage} actionLabel="Dismiss" onAction={() => setSuccessMessage(null)} />
        </View>
      ) : null}

      <PaginatedList<Review>
        queryKey={['admin-reviews', status]}
        // The admin reviews endpoint paginates but ignores `status`, so the
        // filter is applied to each page client-side.
        fetchPage={async (page) => {
          const res = await listAdminReviews({ page, limit: 20 });
          if (!status) return res;
          return { ...res, items: res.items.filter((r) => (r.status ?? 'PUBLISHED') === status) };
        }}
        keyExtractor={(r) => r.id}
        emptyTitle="No reviews here"
        emptySubtitle="Reviews matching this filter will appear here."
        itemHeight={170}
        header={
          <View style={styles.filterWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} equalWidth={false} />
            </ScrollView>
          </View>
        }
        renderItem={(r) => {
          const meta = REVIEW_STATUS_META[r.status ?? 'PUBLISHED'];
          return (
            <Card style={styles.card}>
              <View style={styles.rowTop}>
                <View style={styles.rowText}>
                  <StarRating rating={r.rating} size={14} />
                  <Text style={[styles.meta, { color: t.muted }]}>
                    {[r.authorName, r.listingTitle].filter(Boolean).join(' · ') || 'Anonymous'}
                  </Text>
                  <Text style={[styles.meta, { color: t.faint }]}>{formatDate(r.createdAt)}</Text>
                </View>
                <Badge label={meta?.label ?? humanize(r.status ?? 'PUBLISHED')} tone={meta?.tone ?? 'neutral'} />
              </View>
              {r.comment ? (
                <Text style={[styles.comment, { color: t.fg }]} numberOfLines={3}>
                  {r.comment}
                </Text>
              ) : null}
              <Button label="Moderate" variant="secondary" onPress={() => openModeration(r)} />
            </Card>
          );
        }}
      />

      <Sheet
        visible={target !== null}
        onClose={() => setTarget(null)}
        title="Moderate review"
        subtitle={target?.listingTitle ?? undefined}
        dismissOnBackdrop={false}
        footer={
          <Button
            label={copy.button}
            variant={copy.danger ? 'danger' : 'primary'}
            fullWidth
            loading={moderate.isPending}
            onPress={() => {
              if (target) moderate.mutate({ id: target.id, next: moderation });
            }}
          />
        }
      >
        <Segmented options={MODERATION_OPTIONS} value={moderation} onChange={setModeration} />
        {target?.comment ? (
          <Text style={[styles.sheetComment, { color: t.fg }]}>“{target.comment}”</Text>
        ) : null}
        <TextField
          label="Moderation note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Why this decision was made…"
          multiline
          hint="Recorded with the moderation action."
        />
        {moderate.isError ? <Banner tone="danger" message={messageFor(moderate.error)} /> : null}
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
  rowText: { flex: 1, gap: 4 },
  meta: { fontSize: 13 },
  comment: { fontSize: 14, lineHeight: 20 },
  sheetComment: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
});
