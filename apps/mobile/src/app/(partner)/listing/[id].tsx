/**
 * Partner listing detail — status, pricing, description and specifications,
 * plus the publish / unpublish / archive / edit / availability / delete
 * controls for this listing.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Banner,
  Button,
  Card,
  ErrorState,
  KeyValue,
  Screen,
  SectionHeader,
  Sheet,
  SignInPrompt,
  Skeleton,
  StarRating,
} from '@/components/ui';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import {
  archiveListing,
  deleteListing,
  getPartnerListing,
  publishListing,
  unpublishListing,
} from '@/services/api/partner';
import { ApiError } from '@/services/api/client';
import {
  LISTING_STATUS_META,
  formatDate,
  formatMoney,
  humanize,
  periodWord,
} from '@/utils/format';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

const PUBLISHABLE = ['DRAFT', 'REJECTED', 'UNPUBLISHED', 'SUSPENDED'];
const UNPUBLISHABLE = ['PUBLISHED', 'PENDING_REVIEW'];

export default function PartnerListingDetailScreen() {
  const t = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const listing = useQuery({
    queryKey: ['partner-listing', id],
    queryFn: () => getPartnerListing(id),
    enabled: !!id && !!user,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['partner-listing', id] });
    qc.invalidateQueries({ queryKey: ['partner-listings'] });
    qc.invalidateQueries({ queryKey: ['partner-dashboard'] });
  };

  const lifecycle = useMutation({
    mutationFn: (kind: 'publish' | 'unpublish' | 'archive') => {
      if (kind === 'publish') return publishListing(id);
      if (kind === 'unpublish') return unpublishListing(id);
      return archiveListing(id);
    },
    onSuccess: (_result, kind) => {
      setActionError(null);
      setNotice(
        kind === 'publish'
          ? 'Listing published — it is now visible to customers.'
          : kind === 'unpublish'
            ? 'Listing unpublished — it no longer appears in search.'
            : 'Listing archived.',
      );
      invalidate();
    },
    onError: (e) => setActionError(errorText(e)),
  });

  const remove = useMutation({
    mutationFn: () => deleteListing(id),
    onSuccess: () => {
      setConfirmDelete(false);
      invalidate();
      router.replace('/(partner)/(tabs)/listings');
    },
    onError: (e) => setActionError(errorText(e)),
  });

  const busy = lifecycle.isPending || remove.isPending;

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to manage this listing"
          subtitle="Listing controls are available from your partner account."
          next={`/(partner)/listing/${id}`}
        />
      </Screen>
    );
  }

  if (listing.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={180} radius={t.radiusLg} />
        <Skeleton height={40} radius={12} />
        <Skeleton height={120} radius={t.radiusLg} />
        <Skeleton height={160} radius={t.radiusLg} />
      </Screen>
    );
  }

  if (listing.isError || !listing.data) {
    const notFound = listing.error instanceof ApiError && listing.error.status === 404;
    return (
      <Screen>
        <ErrorState
          title={notFound ? 'Listing not found' : undefined}
          error={listing.error}
          onRetry={notFound ? undefined : () => listing.refetch()}
        />
      </Screen>
    );
  }

  const l = listing.data;
  const status = l.status ?? 'DRAFT';
  const meta = LISTING_STATUS_META[status];
  const period = periodWord(l.pricingPeriod);
  const specs = Object.entries(l.specifications ?? {}).slice(0, 14);

  const canPublish = PUBLISHABLE.includes(status);
  const canUnpublish = UNPUBLISHABLE.includes(status);
  const canArchive = status !== 'ARCHIVED';

  return (
    <Screen scroll>
      {notice ? (
        <Banner tone="success" message={notice} actionLabel="Dismiss" onAction={() => setNotice(null)} />
      ) : null}
      {actionError ? <Banner tone="danger" message={actionError} /> : null}

      {l.coverUrl ? (
        <Image
          source={{ uri: l.coverUrl }}
          style={[styles.cover, { backgroundColor: t.surface3 }]}
          contentFit="cover"
          transition={200}
          accessibilityLabel={l.title}
        />
      ) : (
        <View style={[styles.cover, styles.coverEmpty, { backgroundColor: t.surface3 }]}>
          <Text style={{ color: t.faint, fontSize: 13 }}>No cover image</Text>
        </View>
      )}

      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: t.fgStrong }]}>{l.title}</Text>
        <Badge label={meta?.label ?? status} tone={meta?.tone ?? 'neutral'} />
      </View>
      <Text style={{ color: t.muted, fontSize: 13.5 }}>
        {humanize(l.type)} · {l.categoryName ?? 'Uncategorised'} · {l.city}
      </Text>

      <Card>
        <KeyValue
          layout="row"
          items={[
            {
              label: 'Price',
              value: `${formatMoney(l.priceMinor, l.currency)}${period ? ` / ${period}` : ''}`,
            },
            {
              label: 'Rating',
              value: (
                <StarRating rating={l.ratingAvg ?? 0} size={14} count={l.ratingCount} showValue />
              ),
            },
            ...(l.capacityValue
              ? [
                  {
                    label: 'Capacity',
                    value: `${l.capacityValue} ${l.capacityUnit ? l.capacityUnit.toLowerCase() : ''}`.trim(),
                  },
                ]
              : []),
            {
              label: 'Location',
              value: [l.addressLine, l.city, l.state].filter(Boolean).join(', '),
              block: true,
            },
            ...(l.createdAt ? [{ label: 'Created', value: formatDate(l.createdAt) }] : []),
          ]}
        />
      </Card>

      <View style={styles.actionRow}>
        <Button
          label="Edit listing"
          variant="secondary"
          style={styles.flex}
          onPress={() => router.push(`/(partner)/listing/${l.id}/edit` as never)}
        />
        <Button
          label="Availability"
          variant="secondary"
          style={styles.flex}
          onPress={() => router.push(`/(partner)/availability/${l.id}` as never)}
        />
      </View>

      {canPublish ? (
        <Button
          label="Publish listing"
          fullWidth
          loading={lifecycle.isPending && lifecycle.variables === 'publish'}
          disabled={busy}
          onPress={() => {
            setActionError(null);
            setNotice(null);
            lifecycle.mutate('publish');
          }}
        />
      ) : null}
      {canUnpublish ? (
        <Button
          label="Unpublish listing"
          variant="secondary"
          fullWidth
          loading={lifecycle.isPending && lifecycle.variables === 'unpublish'}
          disabled={busy}
          onPress={() => {
            setActionError(null);
            setNotice(null);
            lifecycle.mutate('unpublish');
          }}
        />
      ) : null}
      {canArchive ? (
        <Button
          label="Archive listing"
          variant="secondary"
          fullWidth
          loading={lifecycle.isPending && lifecycle.variables === 'archive'}
          disabled={busy}
          onPress={() => {
            setActionError(null);
            setNotice(null);
            lifecycle.mutate('archive');
          }}
        />
      ) : null}
      {status === 'PENDING_REVIEW' ? (
        <Text style={{ color: t.faint, fontSize: 12.5, lineHeight: 18 }}>
          This listing is queued for review. You can edit it while the review runs.
        </Text>
      ) : null}
      {status === 'ARCHIVED' ? (
        <Text style={{ color: t.faint, fontSize: 12.5, lineHeight: 18 }}>
          Archived listings are hidden from search. Publish a new listing to take bookings again.
        </Text>
      ) : null}

      {l.description ? (
        <Card>
          <SectionHeader title="About this space" />
          <Text style={{ color: t.fg, fontSize: 14.5, lineHeight: 21 }}>{l.description}</Text>
        </Card>
      ) : null}

      {specs.length ? (
        <Card>
          <SectionHeader title="Specifications" />
          <KeyValue
            layout="row"
            items={specs.map(([key, value]) => ({
              label: humanize(key),
              value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value),
            }))}
          />
        </Card>
      ) : null}

      <Button
        label="Delete listing"
        variant="danger"
        fullWidth
        disabled={busy}
        onPress={() => {
          setActionError(null);
          setConfirmDelete(true);
        }}
      />

      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this listing?"
        subtitle={l.title}
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
              onPress={() => remove.mutate()}
            />
          </View>
        }
      >
        {actionError ? <Banner tone="danger" message={actionError} /> : null}
        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>
          The listing is removed from your catalogue and stops taking requests. This cannot be
          undone.
        </Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 190, borderRadius: 16 },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  actionRow: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  footerRow: { flexDirection: 'row', gap: 10 },
});
