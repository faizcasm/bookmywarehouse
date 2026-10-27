/**
 * Partner listings — server-paginated management with status filters, quick
 * lifecycle actions in a sheet, and a guarded delete flow.
 */

import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Warehouse, Ellipsis } from 'lucide-react-native';
import { Image } from 'expo-image';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  Screen,
  Sheet,
  SignInPrompt,
  StarRating,
} from '@/components/ui';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import {
  archiveListing,
  deleteListing,
  listPartnerListings,
  publishListing,
  unpublishListing,
} from '@/services/api/partner';
import { formatMoney, LISTING_STATUS_META, periodWord } from '@/utils/format';
import type { ListingSummary } from '@/types';

/** Every chip maps to real backend listing statuses (comma lists supported). */
const STATUS_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft', status: 'DRAFT' },
  { key: 'PENDING_REVIEW', label: 'In review', status: 'PENDING_REVIEW' },
  { key: 'PUBLISHED', label: 'Published', status: 'PUBLISHED' },
  { key: 'UNPUBLISHED', label: 'Unpublished', status: 'UNPUBLISHED,SUSPENDED' },
  { key: 'REJECTED', label: 'Rejected', status: 'REJECTED' },
  { key: 'ARCHIVED', label: 'Archived', status: 'ARCHIVED' },
] as const;

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

export default function PartnerListingsScreen() {
  const t = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<string>('ALL');
  const [selected, setSelected] = useState<ListingSummary | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusParam = (STATUS_FILTERS.find((f) => f.key === filter) as { status?: string } | undefined)
    ?.status;
  const fetchPage = useCallback(
    (page: number) => listPartnerListings({ page, limit: 10, status: statusParam }),
    [statusParam],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['partner-listings'] });
    qc.invalidateQueries({ queryKey: ['partner-listing'] });
    qc.invalidateQueries({ queryKey: ['partner-dashboard'] });
  };

  const done = (message: string) => {
    setSelected(null);
    setConfirmDelete(false);
    setActionError(null);
    setNotice(message);
    invalidate();
  };

  const publish = useMutation({
    mutationFn: (id: string) => publishListing(id),
    onSuccess: () => done('Listing published — it is now visible to customers.'),
    onError: (e) => setActionError(errorText(e)),
  });
  const unpublish = useMutation({
    mutationFn: (id: string) => unpublishListing(id),
    onSuccess: () => done('Listing unpublished — it no longer appears in search.'),
    onError: (e) => setActionError(errorText(e)),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveListing(id),
    onSuccess: () => done('Listing archived.'),
    onError: (e) => setActionError(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteListing(id),
    onSuccess: () => done('Listing deleted.'),
    onError: (e) => setActionError(errorText(e)),
  });

  const closeSheets = () => {
    setSelected(null);
    setConfirmDelete(false);
    setActionError(null);
  };

  const openActions = (listing: ListingSummary) => {
    setActionError(null);
    setNotice(null);
    setSelected(listing);
  };

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to manage listings"
          subtitle="Create, publish and price your spaces from the partner console."
          next="/(partner)/(tabs)/listings"
        />
      </Screen>
    );
  }

  const status = selected?.status ?? 'DRAFT';
  const meta = LISTING_STATUS_META[status];
  const busy =
    publish.isPending || unpublish.isPending || archive.isPending || remove.isPending;

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Listings</Text>
        <Button label="New listing" onPress={() => router.push('/(partner)/listing/new')} />
      </View>

      <View style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            size="sm"
            selected={filter === f.key}
            onPress={() => {
              setFilter(f.key);
              setNotice(null);
            }}
          />
        ))}
      </View>

      {notice ? (
        <View style={styles.notice}>
          <Banner tone="success" message={notice} actionLabel="Dismiss" onAction={() => setNotice(null)} />
        </View>
      ) : null}

      <PaginatedList<ListingSummary>
        queryKey={['partner-listings', filter]}
        fetchPage={fetchPage}
        keyExtractor={(l) => l.id}
        itemHeight={112}
        emptyTitle={
          filter === 'ALL' ? 'No listings yet' : 'No listings with this status'
        }
        emptySubtitle={
          filter === 'ALL'
            ? 'Create your first listing to start taking booking requests.'
            : 'Try a different status filter to see your other listings.'
        }
        renderItem={(l) => {
          const itemMeta = LISTING_STATUS_META[l.status ?? 'DRAFT'];
          const period = periodWord(l.pricingPeriod);
          return (
            <Card onPress={() => router.push(`/(partner)/listing/${l.id}` as never)} style={styles.row}>
              {l.coverUrl ? (
                <Image
                  source={{ uri: l.coverUrl }}
                  style={styles.thumb}
                  contentFit="cover"
                  transition={180}
                  accessibilityLabel={l.title}
                />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: t.surface3 }]}>
                  <Warehouse size={24} color={t.faint} />
                </View>
              )}

              <View style={styles.info}>
                <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={1}>
                  {l.title}
                </Text>
                <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
                  {l.city}
                </Text>
                <Text style={[styles.price, { color: t.fgStrong }]}>
                  {formatMoney(l.priceMinor, l.currency)}
                  {period ? ` / ${period}` : ''}
                </Text>
                {l.ratingCount ? (
                  <StarRating rating={l.ratingAvg ?? 0} size={13} count={l.ratingCount} showValue />
                ) : null}
              </View>

              <View style={styles.rowRight}>
                <Badge label={itemMeta?.label ?? l.status} tone={itemMeta?.tone ?? 'neutral'} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Actions for ${l.title}`}
                  hitSlop={8}
                  onPress={() => openActions(l)}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: t.surface3 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ellipsis size={20} color={t.muted} />
                </Pressable>
              </View>
            </Card>
          );
        }}
      />

      <Sheet
        visible={!!selected}
        onClose={closeSheets}
        title={selected?.title}
        subtitle={meta ? `${meta.label} · ${selected?.city ?? ''}` : selected?.city}
        dismissOnBackdrop={!busy}
      >
        {actionError ? <Banner tone="danger" message={actionError} /> : null}

        <Button
          label="View details"
          variant="secondary"
          fullWidth
          onPress={() => {
            const id = selected?.id;
            closeSheets();
            if (id) router.push(`/(partner)/listing/${id}` as never);
          }}
        />
        <Button
          label="Edit listing"
          variant="secondary"
          fullWidth
          onPress={() => {
            const id = selected?.id;
            closeSheets();
            if (id) router.push(`/(partner)/listing/${id}/edit` as never);
          }}
        />
        <Button
          label="Manage availability"
          variant="secondary"
          fullWidth
          onPress={() => {
            const id = selected?.id;
            closeSheets();
            if (id) router.push(`/(partner)/availability/${id}` as never);
          }}
        />

        {status === 'PUBLISHED' || status === 'PENDING_REVIEW' ? (
          <Button
            label="Unpublish"
            variant="secondary"
            fullWidth
            loading={unpublish.isPending && !!selected}
            disabled={busy}
            onPress={() => selected && unpublish.mutate(selected.id)}
          />
        ) : null}
        {status === 'DRAFT' ||
        status === 'REJECTED' ||
        status === 'UNPUBLISHED' ||
        status === 'SUSPENDED' ? (
          <Button
            label="Publish"
            fullWidth
            loading={publish.isPending && !!selected}
            disabled={busy}
            onPress={() => selected && publish.mutate(selected.id)}
          />
        ) : null}
        {status !== 'ARCHIVED' ? (
          <Button
            label="Archive listing"
            variant="ghost"
            fullWidth
            loading={archive.isPending && !!selected}
            disabled={busy}
            onPress={() => selected && archive.mutate(selected.id)}
          />
        ) : null}
        <Button
          label="Delete listing"
          variant="danger"
          fullWidth
          disabled={busy}
          onPress={() => setConfirmDelete(true)}
        />
      </Sheet>

      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this listing?"
        subtitle={selected?.title}
        dismissOnBackdrop={false}
        footer={
          <View style={styles.footerRow}>
            <Button
              label="Keep listing"
              variant="secondary"
              style={styles.flex}
              disabled={remove.isPending}
              onPress={() => setConfirmDelete(false)}
            />
            <Button
              label="Delete"
              variant="danger"
              style={styles.flex}
              loading={remove.isPending}
              onPress={() => selected && remove.mutate(selected.id)}
            />
          </View>
        }
      >
        {actionError ? <Banner tone="danger" message={actionError} /> : null}
        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>
          The listing is removed from your catalogue and stops taking requests.
          This cannot be undone.
        </Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
  },
  heading: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  notice: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15.5, fontWeight: '700' },
  price: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  footerRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
