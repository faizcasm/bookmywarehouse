/** Admin listings — moderation queue (approve/reject/suspend/restore). */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAdminListings, moderateListing, type AdminListingRow, type ListingModerationDecision } from '@/services/api/admin';
import { formatMoney, humanize, LISTING_STATUS_META } from '@/utils/format';

export default function AdminListingsScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const listings = useQuery({ queryKey: ['admin-listings'], queryFn: () => listAdminListings({ limit: 50 }) });

  const moderate = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ListingModerationDecision }) =>
      moderateListing(id, decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-listings'] }),
    onError: (e) => Alert.alert('Action failed', e instanceof Error ? e.message : 'Try again.'),
  });

  if (listings.isLoading) {
    return (
      <Screen scroll>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={120} radius={16} />
        ))}
      </Screen>
    );
  }
  if (listings.isError) {
    return (
      <Screen>
        <ErrorState error={listings.error} onRetry={() => listings.refetch()} />
      </Screen>
    );
  }

  const items = (listings.data?.items ?? []) as AdminListingRow[];

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Listings</Text>
      {items.length ? (
        items.map((l) => {
          const id = l.id;
          const status = l.status ?? 'DRAFT';
          const meta = LISTING_STATUS_META[status as keyof typeof LISTING_STATUS_META];
          const needsReview = status === 'PENDING_REVIEW';
          const isPublished = status === 'PUBLISHED';
          return (
            <Card key={id} style={{ gap: 6 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={1}>
                    {l.title ?? 'Untitled'}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>
                    {humanize(l.type ?? '')} · {l.city ?? ''}
                  </Text>
                  {l.price?.amount != null ? (
                    <Text style={{ color: t.fgStrong, fontWeight: '700' }}>
                      {formatMoney(Math.round(l.price.amount * 100), l.price.currency ?? 'INR')}
                    </Text>
                  ) : null}
                </View>
                <Badge label={meta?.label ?? status} tone={meta?.tone ?? 'neutral'} />
              </View>
              <View style={styles.actions}>
                {needsReview || status === 'REJECTED' || status === 'SUSPENDED' || status === 'DRAFT' ? (
                  <Button label="Approve" onPress={() => moderate.mutate({ id, decision: 'APPROVE' })} />
                ) : null}
                {needsReview || isPublished ? (
                  <Button
                    label={isPublished ? 'Suspend' : 'Reject'}
                    variant="danger"
                    onPress={() => moderate.mutate({ id, decision: isPublished ? 'SUSPEND' : 'REJECT' })}
                  />
                ) : null}
                {status === 'SUSPENDED' ? (
                  <Button label="Restore" variant="secondary" onPress={() => moderate.mutate({ id, decision: 'UNSUSPEND' })} />
                ) : null}
              </View>
            </Card>
          );
        })
      ) : (
        <Card>
          <Text style={{ color: t.muted }}>No listings to moderate.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
