/**
 * Availability — pick which listing's schedule you want to manage.
 *
 * Weekly rules and blocked dates live per listing, so the flow starts with the
 * catalogue and drills into /(partner)/availability/[listingId].
 */

import { router } from 'expo-router';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Card, Screen, SectionHeader, SignInPrompt } from '@/components/ui';
import { listPartnerListings } from '@/services/api/partner';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { LISTING_STATUS_META, formatMoney, humanize, periodWord } from '@/utils/format';
import type { ListingSummary } from '@/types';

export default function PartnerAvailabilityPickerScreen() {
  const t = useTheme();
  const { user } = useSession();

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to manage availability"
          subtitle="Weekly rules and blocked dates are managed from your partner account."
          next="/(partner)/availability"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader title="Availability" />
      <Text style={[styles.intro, { color: t.muted }]}>
        Pick a listing to set its weekly open hours and the dates it can’t be booked.
      </Text>
      <PaginatedList<ListingSummary>
        queryKey={['partner-listings', 'availability-picker']}
        fetchPage={(page) => listPartnerListings({ page, limit: 20 })}
        keyExtractor={(item) => item.id}
        itemHeight={104}
        emptyTitle="No listings yet"
        emptySubtitle="Create a listing first, then come back to set its availability."
        renderItem={(listing) => {
          const meta = listing.status ? LISTING_STATUS_META[listing.status] : undefined;
          const period = periodWord(listing.pricingPeriod);
          return (
            <Card
              style={styles.row}
              onPress={() => router.push(`/(partner)/availability/${listing.id}` as never)}
            >
              <View style={styles.rowInner}>
                {listing.coverUrl ? (
                  <Image
                    source={{ uri: listing.coverUrl }}
                    style={[styles.thumb, { backgroundColor: t.surface3 }]}
                    contentFit="cover"
                    transition={150}
                    accessibilityLabel={listing.title}
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: t.surface3 }]}>
                    <Text style={{ color: t.faint, fontSize: 11 }}>No photo</Text>
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: t.fgStrong }]} numberOfLines={1}>
                    {listing.title}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 12.5 }} numberOfLines={1}>
                    {humanize(listing.type)} · {listing.city}
                  </Text>
                  <View style={styles.rowMeta}>
                    <Text style={{ color: t.faint, fontSize: 12 }}>
                      {formatMoney(listing.priceMinor, listing.currency)}
                      {period ? ` / ${period}` : ''}
                    </Text>
                    {meta ? <Badge label={meta.label} tone={meta.tone} /> : null}
                  </View>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13.5, lineHeight: 19, marginTop: -6 },
  row: { padding: 12 },
  rowInner: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
});
