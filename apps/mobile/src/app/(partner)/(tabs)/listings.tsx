/** Partner listings — list with publish/unpublish/archive actions. */

import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import {
  listPartnerListings,
  publishListing,
  unpublishListing,
  archiveListing,
} from '@/services/api/partner';
import { formatMoney, LISTING_STATUS_META } from '@/utils/format';

export default function PartnerListingsScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const listings = useQuery({ queryKey: ['partner-listings'], queryFn: () => listPartnerListings({ limit: 50 }) });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['partner-listings'] });

  const publish = useMutation({
    mutationFn: publishListing,
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Could not publish', e instanceof Error ? e.message : 'Try again.'),
  });
  const unpublish = useMutation({ mutationFn: unpublishListing, onSuccess: invalidate });
  const archive = useMutation({
    mutationFn: archiveListing,
    onSuccess: invalidate,
  });

  if (listings.isLoading) {
    return (
      <Screen scroll>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={110} radius={16} />
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

  const items = listings.data?.items ?? [];

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Listings</Text>
        <Button label="+ New listing" onPress={() => router.push('/(partner)/listing/new')} />
      </View>

      {items.length ? (
        items.map((l) => {
          const meta = LISTING_STATUS_META[l.status ?? 'DRAFT'];
          return (
            <Card key={l.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: t.fgStrong }]} numberOfLines={1}>
                    {l.title}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>{l.city}</Text>
                  <Text style={{ color: t.fgStrong, fontWeight: '700', marginTop: 4 }}>
                    {formatMoney(l.priceMinor, l.currency)}/{l.pricingPeriod?.toLowerCase()}
                  </Text>
                </View>
                <Badge label={meta?.label ?? l.status} tone={meta?.tone ?? 'neutral'} />
              </View>
              <View style={styles.actions}>
                {(l.status === 'DRAFT' || l.status === 'REJECTED' || l.status === 'UNPUBLISHED' || l.status === 'SUSPENDED') ? (
                  <Button label="Publish" variant="secondary" onPress={() => publish.mutate(l.id)} loading={publish.isPending} />
                ) : null}
                {(l.status === 'PUBLISHED' || l.status === 'PENDING_REVIEW') ? (
                  <Button label="Unpublish" variant="secondary" onPress={() => unpublish.mutate(l.id)} />
                ) : null}
                <Button label="Availability" variant="ghost" onPress={() => router.push(`/(partner)/listing/${l.id}/availability`)} />
                <Button
                  label="Archive"
                  variant="ghost"
                  onPress={() =>
                    Alert.alert('Archive listing', 'This hides the listing permanently.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Archive', style: 'destructive', onPress: () => archive.mutate(l.id) },
                    ])
                  }
                />
              </View>
            </Card>
          );
        })
      ) : (
        <Card>
          <Text style={{ color: t.muted }}>No listings yet. Create your first listing to start taking bookings.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});
