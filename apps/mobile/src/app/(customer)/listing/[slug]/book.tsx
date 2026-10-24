/** Booking flow — pick dates + units, get a quote, create the booking. */

import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, LoadingOverlay, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getListing } from '@/services/api/catalog';
import { getQuote, createBooking } from '@/services/api/bookings';
import { formatMoney } from '@/utils/format';
import { ApiError } from '@/services/api/client';

function today(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function BookListingScreen() {
  const t = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const listing = useQuery({
    queryKey: ['listing', slug],
    queryFn: () => getListing(slug!),
    enabled: !!slug,
  });

  const [startDate, setStartDate] = useState(today(1));
  const [endDate, setEndDate] = useState(today(8));
  const [units, setUnits] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const quote = useMutation({
    mutationFn: () =>
      getQuote({
        listingId: listing.data!.id,
        startDate,
        endDate: endDate || undefined,
        spaceUnits: Number(units) || 1,
      }),
    onSuccess: () => setError(null),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not fetch a quote.'),
  });

  const book = useMutation({
    mutationFn: () =>
      createBooking({
        listingId: listing.data!.id,
        startDate,
        endDate: endDate || undefined,
        spaceUnits: Number(units) || 1,
      }),
    onSuccess: (booking) => {
      Alert.alert('Booking requested', 'Your booking has been created and is pending confirmation.', [
        { text: 'View booking', onPress: () => router.replace(`/(customer)/booking/${booking.id}`) },
      ]);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not create the booking.'),
  });

  if (listing.isLoading) return <LoadingOverlay />;
  if (listing.isError || !listing.data) {
    return (
      <Screen>
        <ErrorState error={listing.error} onRetry={() => listing.refetch()} />
      </Screen>
    );
  }

  const l = listing.data;
  const q = quote.data;

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: t.fgStrong }]}>{l.title}</Text>
      <Text style={{ color: t.muted }}>
        {formatMoney(l.priceMinor, l.currency)} /{l.pricingPeriod?.toLowerCase()}
      </Text>

      <TextField
        label="Start date (YYYY-MM-DD)"
        value={startDate}
        onChangeText={setStartDate}
        placeholder="2026-01-01"
        autoCapitalize="none"
      />
      <TextField
        label="End date (YYYY-MM-DD, optional)"
        value={endDate}
        onChangeText={setEndDate}
        placeholder="2026-01-08"
        autoCapitalize="none"
      />
      <TextField
        label="Space units"
        value={units}
        onChangeText={setUnits}
        keyboardType="numeric"
        placeholder="1"
      />

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: t.dangerSoft }]}>
          <Text style={{ color: t.dangerSoftFg }}>{error}</Text>
        </View>
      ) : null}

      <Button label="Get quote" onPress={() => quote.mutate()} loading={quote.isPending} variant="secondary" fullWidth />

      {q ? (
        <Card>
          <Text style={[styles.cardTitle, { color: t.fgStrong }]}>Quote</Text>
          <Row label="Base" value={formatMoney(q.baseMinor, q.currency)} />
          <Row label="Taxes" value={formatMoney(q.taxesMinor, q.currency)} />
          <Row label="Fees" value={formatMoney(q.feesMinor, q.currency)} />
          <View style={[styles.totalRow, { borderTopColor: t.line }]}>
            <Text style={{ color: t.fgStrong, fontWeight: '700' }}>Total</Text>
            <Text style={{ color: t.fgStrong, fontWeight: '800', fontSize: 18 }}>{formatMoney(q.totalMinor, q.currency)}</Text>
          </View>
        </Card>
      ) : null}

      <Button
        label={q ? 'Confirm booking' : 'Book now'}
        onPress={() => (q ? book.mutate() : quote.mutate())}
        loading={book.isPending}
        fullWidth
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: t.muted }}>{label}</Text>
      <Text style={{ color: t.fg }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800' },
  errorBox: { padding: 12, borderRadius: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
});