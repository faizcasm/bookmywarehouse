/**
 * Disputes — the customer's dispute cases plus the open-a-dispute flow
 * (booking picker → reason → description → case reference).
 */

import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  Screen,
  Sheet,
  TextField,
  SignInPrompt,
  type BadgeTone,
} from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import {
  listDisputes,
  openDispute,
  DISPUTE_REASONS,
  type DisputeReason,
} from '@/services/api/account';
import { listBookings } from '@/services/api/bookings';
import { formatDate, humanize, shortenId } from '@/utils/format';
import type { Dispute } from '@/types';

const DESCRIPTION_MIN = 20;

function disputeTone(status: string): BadgeTone {
  switch (status) {
    case 'OPEN':
      return 'warn';
    case 'UNDER_REVIEW':
      return 'info';
    case 'RESOLVED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function DisputesScreen() {
  const t = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [reason, setReason] = useState<DisputeReason>('SERVICE_NOT_DELIVERED');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  // Candidate bookings — only fetched while the sheet is open.
  const bookings = useQuery({
    queryKey: ['bookings', 'for-dispute'],
    queryFn: () => listBookings({ limit: 50 }),
    enabled: !!user && sheetOpen,
  });

  const create = useMutation({
    mutationFn: () => openDispute(bookingId, { reason, description: description.trim() }),
    onSuccess: (res) => {
      setReference(res.reference);
      qc.invalidateQueries({ queryKey: ['disputes'] });
    },
    onError: (err) =>
      setFormError(err instanceof Error ? err.message : 'Could not open the dispute.'),
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to manage disputes"
          subtitle="If something goes wrong with a booking, you can raise it here."
          next="/(customer)/disputes"
        />
      </Screen>
    );
  }

  const descriptionShort = description.trim().length < DESCRIPTION_MIN;
  const canSubmit = Boolean(bookingId) && !descriptionShort;

  const resetForm = () => {
    setBookingId('');
    setReason('SERVICE_NOT_DELIVERED');
    setDescription('');
    setFormError(null);
    setReference(null);
  };

  const openSheet = () => {
    resetForm();
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    resetForm();
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Disputes</Text>
        <Button label="New dispute" variant="secondary" onPress={openSheet} />
      </View>

      <PaginatedList<Dispute>
        queryKey={['disputes']}
        fetchPage={(page) => listDisputes({ page })}
        keyExtractor={(d) => d.id}
        itemHeight={130}
        emptyTitle="No disputes"
        emptySubtitle="If something goes wrong with a booking, you can open a dispute here."
        renderItem={(d) => (
          <Card onPress={() => router.push(`/(customer)/booking/${d.bookingId}`)}>
            <View style={styles.rowTop}>
              <Text style={[styles.bookingRef, { color: t.fgStrong }]} numberOfLines={1}>
                Booking {shortenId(d.bookingId)}
              </Text>
              <Badge label={humanize(d.status) || d.status} tone={disputeTone(d.status)} />
            </View>
            <Text style={{ color: t.fg, fontWeight: '600', marginTop: 2 }}>
              {humanize(d.reason)}
            </Text>
            {d.resolution ? (
              <Text style={[styles.resolution, { color: t.muted }]}>
                Resolution: {d.resolution}
              </Text>
            ) : null}
            <Text style={{ color: t.faint, fontSize: 12, marginTop: 4 }}>
              Opened {formatDate(d.createdAt)}
            </Text>
          </Card>
        )}
      />

      <Sheet
        visible={sheetOpen}
        onClose={closeSheet}
        title="Open a dispute"
        subtitle="We'll review the case with the partner and get back to you."
        dismissOnBackdrop={false}
        footer={
          reference ? (
            <Button label="Done" onPress={closeSheet} fullWidth />
          ) : (
            <Button
              label="Submit dispute"
              onPress={() => create.mutate()}
              loading={create.isPending}
              disabled={!canSubmit}
              fullWidth
            />
          )
        }
      >
        {reference ? (
          <Banner
            tone="success"
            title="Dispute opened"
            message={`Your case reference is ${reference}. Keep it handy — support will quote it in any follow-up.`}
          />
        ) : (
          <>
            {formError ? <Banner tone="danger" message={formError} /> : null}

            <Text style={[styles.sheetLabel, { color: t.fgStrong }]}>Booking</Text>
            {bookings.isLoading ? (
              <Text style={{ color: t.muted, fontSize: 13 }}>Loading your bookings…</Text>
            ) : (bookings.data?.items ?? []).length ? (
              <View style={styles.wrapRow}>
                {bookings.data?.items.map((b) => (
                  <Chip
                    key={b.id}
                    label={`${b.reference ?? shortenId(b.id)}${b.listingTitle ? ` · ${b.listingTitle}` : ''}`}
                    selected={bookingId === b.id}
                    size="sm"
                    onPress={() => setBookingId(b.id)}
                  />
                ))}
              </View>
            ) : (
              <Text style={{ color: t.muted, fontSize: 13 }}>
                You have no bookings that can be disputed yet.
              </Text>
            )}

            <Text style={[styles.sheetLabel, { color: t.fgStrong }]}>Reason</Text>
            <View style={styles.wrapRow}>
              {DISPUTE_REASONS.map((r) => (
                <Chip
                  key={r}
                  label={humanize(r)}
                  selected={reason === r}
                  size="sm"
                  onPress={() => setReason(r)}
                />
              ))}
            </View>

            <TextField
              label="Describe the issue"
              value={description}
              onChangeText={setDescription}
              placeholder="What went wrong, and what would you like resolved?"
              multiline
              hint={`At least ${DESCRIPTION_MIN} characters — dates and amounts help us investigate faster.`}
              error={
                description && descriptionShort
                  ? `Add at least ${DESCRIPTION_MIN} characters (${description.trim().length} so far)`
                  : undefined
              }
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  heading: { fontSize: 22, fontWeight: '800' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bookingRef: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  resolution: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  sheetLabel: { fontSize: 14, fontWeight: '700' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
