/** Admin listings — moderation queue (approve/reject/suspend/restore). */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAdminListings, moderateListing } from '@/services/api/admin';
import { formatMoney, humanize, LISTING_STATUS_META } from '@/utils/format';

export default function AdminListingsScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const listings = useQuery({ queryKey: ['admin-listings'], queryFn: () => listAdminListings({ limit: 50 }) });

  const moderate = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' | 'suspend' | 'restore' }) =>
      moderateListing(id, action),
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

  const items = (listings.data?.items ?? []) as Array<Record<string, unknown>>;

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Listings</Text>
      {items.length ? (
        items.map((l) => {
          const id = String(l.id);
          const status = String(l.status ?? 'DRAFT');
          const meta = LISTING_STATUS_META[status as keyof typeof LISTING_STATUS_META];
          return (
            <Card key={id} style={{ gap: 6 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={1}>
                    {String(l.title ?? 'Untitled')}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>
                    {humanize(String(l.type ?? ''))} · {String(l.city ?? '')}
                  </Text>
                  {l.basePriceMinor != null ? (
                    <Text style={{ color: t.fgStrong, fontWeight: '700' }}>
                      {formatMoney(Number(l.basePriceMinor))}
                    </Text>
                  ) : null}
                </View>
                <Badge label={meta?.label ?? status} tone={meta?.tone ?? 'neutral'} />
              </View>
              <View style={styles.actions}>
                {status !== 'ACTIVE' ? (
                  <Button label="Approve" onPress={() => moderate.mutate({ id, action: 'approve' })} />
                ) : null}
                {status === 'ACTIVE' ? (
                  <Button label="Suspend" variant="danger" onPress={() => moderate.mutate({ id, action: 'suspend' })} />
                ) : null}
                {status === 'REJECTED' || status === 'SUSPENDED' ? (
                  <Button label="Restore" variant="secondary" onPress={() => moderate.mutate({ id, action: 'restore' })} />
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
