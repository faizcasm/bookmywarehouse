/** Booking flow — pick dates + units, get a quote, create the booking. */

import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  DateField,
  ErrorState,
  KeyValue,
  LoadingOverlay,
  Screen,
  SectionHeader,
  SignInPrompt,
  TextField,
  formatDisplayDate,
  todayOnly,
  toDateOnly,
} from '@/components/ui';
import { createBooking, getQuote, type QuoteInput } from '@/services/api/bookings';
import { getListing } from '@/services/api/catalog';
import { ApiError } from '@/services/api/client';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { formatMoney } from '@/utils/format';

const MAX_UNITS = 99;
const NOTES_MAX = 1000;
/** Remaining capacity at or below this shows an amber "almost full" hint. */
const LOW_CAPACITY = 5;

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export default function BookListingScreen() {
  const t = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { status } = useSession();

  const listing = useQuery({
    queryKey: ['listing', slug],
    queryFn: () => getListing(slug!),
    enabled: !!slug,
  });

  const [startDate, setStartDate] = useState(() => toDateOnly(addDays(todayOnly(), 1)));
  const [endDate, setEndDate] = useState<string | null>(() => toDateOnly(addDays(todayOnly(), 7)));
  const [openEnded, setOpenEnded] = useState(false);
  const [units, setUnits] = useState(1);
  const [deliveryRequired, setDeliveryRequired] = useState(false);
  const [operatorRequired, setOperatorRequired] = useState(false);
  const [notes, setNotes] = useState('');
  // Key of the inputs the current quote was priced for — stale quotes are
  // ignored (derived during render, never patched inside an effect).
  const [quotedKey, setQuotedKey] = useState<string | null>(null);

  const l = listing.data ?? null;
  const quoteInput: QuoteInput | null = l
    ? {
        listingId: l.id,
        startDate,
        endDate: openEnded ? undefined : endDate ?? undefined,
        spaceUnits: units,
        deliveryRequired,
        operatorRequired,
      }
    : null;
  const inputKey = quoteInput ? JSON.stringify(quoteInput) : '';

  const quoteMutation = useMutation({
    mutationFn: () => getQuote(quoteInput!),
    onSuccess: () => setQuotedKey(inputKey),
  });

  const book = useMutation({
    mutationFn: () =>
      createBooking({
        ...quoteInput!,
        notes: notes.trim() ? notes.trim() : undefined,
      }),
    onSuccess: (booking) => router.replace(`/(customer)/booking/${booking.id}`),
  });

  const endError =
    !openEnded && endDate && endDate < startDate
      ? 'End date must be on or after the start date.'
      : undefined;
  const datesValid = Boolean(startDate) && (openEnded || Boolean(endDate && !endError));
  const canQuote = Boolean(l && datesValid && units >= 1 && l.canRequestBooking !== false);
  // Only a quote priced for the *current* inputs counts as fresh.
  const quote = quoteMutation.data && quotedKey === inputKey ? quoteMutation.data : null;
  const unavailable = quote ? !quote.available : false;
  const lowCapacity =
    quote?.remainingCapacity != null &&
    quote.remainingCapacity > 0 &&
    quote.remainingCapacity <= LOW_CAPACITY;

  if (status !== 'authenticated') {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to book this space"
          subtitle="Booking requests are tied to your account so partners can confirm them."
          next={`/(customer)/listing/${slug}/book`}
        />
      </Screen>
    );
  }
  if (listing.isLoading) return <LoadingOverlay />;
  if (listing.isError || !l) {
    return (
      <Screen>
        <ErrorState error={listing.error} onRetry={() => listing.refetch()} />
      </Screen>
    );
  }

  const isWarehouse = l.type === 'WAREHOUSE';
  const unitLabel = isWarehouse ? 'Space units' : 'Quantity';

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.fgStrong }]}>{l.title}</Text>
        <Text style={{ color: t.muted }}>
          {formatMoney(l.priceMinor, l.currency)} /{l.pricingPeriod?.toLowerCase()}
        </Text>
      </View>

      {l.canRequestBooking === false ? (
        <Banner
          tone="warn"
          title="Bookings paused"
          message="This listing isn't taking new booking requests right now. You can message the partner from the listing page."
        />
      ) : null}

      <SectionHeader title="Dates" />
      <View style={styles.dates}>
        <DateField
          label="Start date"
          value={startDate}
          onChange={(date) => {
            setStartDate(date);
            if (endDate && endDate < date) setEndDate(date);
          }}
          min={toDateOnly(todayOnly())}
        />
        {!openEnded ? (
          <DateField
            label="End date"
            value={endDate}
            onChange={setEndDate}
            min={startDate}
            error={endError}
            hint={'Not sure yet? Switch on "Open-ended" below.'}
          />
        ) : null}
        <View style={styles.chips}>
          <Chip
            label="Open-ended (no end date)"
            selected={openEnded}
            onPress={() => setOpenEnded((v) => !v)}
          />
        </View>
        {!openEnded && endDate ? (
          <Text style={{ color: t.faint, fontSize: 13 }}>
            {formatDisplayDate(startDate)} → {formatDisplayDate(endDate)}
          </Text>
        ) : null}
      </View>

      <SectionHeader title="How much space?" />
      <Card>
        <View style={styles.stepperRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: t.fg }]}>{unitLabel}</Text>
            {l.capacityValue ? (
              <Text style={{ color: t.faint, fontSize: 13 }}>
                Total capacity {l.capacityValue} {l.capacityUnit ?? ''}
              </Text>
            ) : null}
          </View>
          <View style={[styles.stepper, { backgroundColor: t.surface3 }]}>
            <Pressable
              onPress={() => setUnits((u) => Math.max(1, u - 1))}
              disabled={units <= 1}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${unitLabel.toLowerCase()}`}
              style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.6 }]}
            >
              <Minus size={18} color={units <= 1 ? t.faint : t.fg} />
            </Pressable>
            <Text style={[styles.stepValue, { color: t.fgStrong }]} accessibilityLiveRegion="polite">
              {units}
            </Text>
            <Pressable
              onPress={() => setUnits((u) => Math.min(MAX_UNITS, u + 1))}
              disabled={units >= MAX_UNITS}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Increase ${unitLabel.toLowerCase()}`}
              style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.6 }]}
            >
              <Plus size={18} color={units >= MAX_UNITS ? t.faint : t.fg} />
            </Pressable>
          </View>
        </View>
      </Card>

      <SectionHeader title="Add-ons" />
      <View style={styles.chips}>
        <Chip
          label="Delivery required"
          selected={deliveryRequired}
          onPress={() => setDeliveryRequired((v) => !v)}
        />
        <Chip
          label="Operator / crew required"
          selected={operatorRequired}
          onPress={() => setOperatorRequired((v) => !v)}
        />
      </View>

      <SectionHeader title="Notes for the partner" />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={(text) => setNotes(text.slice(0, NOTES_MAX))}
        placeholder="Access details, timing, anything the partner should know…"
        multiline
        numberOfLines={4}
        hint={`${notes.length}/${NOTES_MAX} characters`}
      />

      {l.canRequestBooking === false ? null : (
        <>
          <SectionHeader title="Quote" />
          <Card style={styles.quoteCard}>
            {quote ? (
              <>
                {quote.rateDescription ? (
                  <Text style={{ color: t.muted, fontSize: 13, marginBottom: 6 }}>
                    {quote.rateDescription}
                  </Text>
                ) : null}
                {quote.breakdown.length ? (
                  <KeyValue
                    items={quote.breakdown.map((line) => ({
                      label: line.label,
                      value: formatMoney(line.amountMinor, quote.currency),
                    }))}
                  />
                ) : (
                  <KeyValue
                    items={[
                      { label: 'Base', value: formatMoney(quote.baseMinor, quote.currency) },
                      { label: 'Taxes', value: formatMoney(quote.taxesMinor, quote.currency) },
                      { label: 'Fees', value: formatMoney(quote.feesMinor, quote.currency) },
                      ...(quote.discountMinor > 0
                        ? [
                            {
                              label: 'Discount',
                              value: `−${formatMoney(quote.discountMinor, quote.currency)}`,
                            },
                          ]
                        : []),
                    ]}
                  />
                )}
                <View style={[styles.totalRow, { borderTopColor: t.line }]}>
                  <Text style={{ color: t.fgStrong, fontWeight: '700' }}>Total</Text>
                  <Text style={[styles.total, { color: t.fgStrong }]}>
                    {formatMoney(quote.totalMinor, quote.currency)}
                  </Text>
                </View>
                <Text style={{ color: t.faint, fontSize: 12.5 }}>
                  For {formatDisplayDate(quote.startDate)}
                  {quote.endDate !== quote.startDate ? ` → ${formatDisplayDate(quote.endDate)}` : ''}
                  {' · '}
                  {quote.spaceUnits} × {unitLabel.toLowerCase()}
                </Text>
              </>
            ) : (
              <Text style={{ color: t.muted, fontSize: 14 }}>
                Get a quote to see the exact price — including taxes and fees — before you commit.
              </Text>
            )}
          </Card>

          {quoteMutation.isError ? (
            <Banner
              tone="danger"
              title="Couldn't fetch a quote"
              message={
                quoteMutation.error instanceof ApiError
                  ? quoteMutation.error.message
                  : 'Check your connection and try again.'
              }
              actionLabel="Try again"
              onAction={() => quoteMutation.mutate()}
            />
          ) : null}

          {unavailable && quote ? (
            <Banner
              tone="danger"
              title="Not available for these dates"
              message={quote.unavailableReason ?? 'The requested space or dates are unavailable.'}
            />
          ) : null}

          {lowCapacity && quote ? (
            <Banner
              tone="warn"
              message={`Only ${quote.remainingCapacity} ${isWarehouse ? 'space units' : 'units'} left for these dates.`}
            />
          ) : null}

          <Button
            label={quote ? 'Update quote' : 'Get quote'}
            variant="secondary"
            fullWidth
            disabled={!canQuote}
            loading={quoteMutation.isPending}
            onPress={() => quoteMutation.mutate()}
          />

          {book.isError ? (
            <Banner
              tone="danger"
              title="Couldn't create the booking"
              message={
                book.error instanceof ApiError
                  ? book.error.message
                  : 'Something went wrong. Please try again.'
              }
            />
          ) : null}

          <Button
            label={openEnded ? 'Request booking' : 'Confirm booking'}
            fullWidth
            disabled={!canQuote || !quote || unavailable}
            loading={book.isPending}
            onPress={() => book.mutate()}
          />
          {!quote ? (
            <Text style={{ color: t.faint, fontSize: 13, textAlign: 'center' }}>
              Get a quote first — the price is confirmed before you book.
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: { fontSize: 22, fontWeight: '800' },
  dates: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, padding: 4 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: 17, fontWeight: '700', minWidth: 40, textAlign: 'center' },
  quoteCard: { gap: 6 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  total: { fontSize: 20, fontWeight: '800' },
});
