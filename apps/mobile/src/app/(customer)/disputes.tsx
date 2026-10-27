/** Disputes — list + open a new dispute against a booking. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Button, Card, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listDisputes, openDispute, DISPUTE_REASONS, type DisputeReason } from '@/services/api/account';
import { listBookings } from '@/services/api/bookings';
import { formatDate, humanize } from '@/utils/format';
import type { Dispute } from '@/types';

const DESCRIPTION_MIN = 20;

export default function DisputesScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [reason, setReason] = useState<DisputeReason>('SERVICE_NOT_DELIVERED');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const bookings = useQuery({ queryKey: ['bookings-for-dispute'], queryFn: () => listBookings({ limit: 50 }) });

  const create = useMutation({
    mutationFn: () => openDispute(bookingId, { reason, description: description.trim() }),
    onSuccess: () => {
      Alert.alert('Dispute opened', "We'll review it and get back to you.");
      setBookingId('');
      setDescription('');
      setOpen(false);
      setError(null);
      qc.invalidateQueries({ queryKey: ['disputes'] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not open the dispute.'),
  });

  const bookingItems = bookings.data?.items ?? [];
  const canSubmit = bookingId && description.trim().length >= DESCRIPTION_MIN;

  return (
    <Screen padTop={false} style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Disputes</Text>
        <Button label={open ? 'Close' : 'New dispute'} variant="secondary" onPress={() => setOpen((o) => !o)} />
      </View>

      {open ? (
        <Card style={styles.form}>
          <Text style={{ color: t.fg, fontWeight: '600' }}>Open a dispute</Text>

          <Text style={{ color: t.faint, fontSize: 12 }}>Choose a booking</Text>
          {bookingItems.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {bookingItems.map((b) => {
                const active = bookingId === b.id;
                return (
                  <Text
                    key={b.id}
                    onPress={() => setBookingId(b.id)}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? t.brand : t.surface, borderColor: active ? t.brand : t.line, color: active ? t.brandFg : t.fg },
                    ]}
                  >
                    {b.listingTitle ?? b.reference ?? b.id}
                  </Text>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={{ color: t.muted, fontSize: 13 }}>No bookings available to dispute.</Text>
          )}

          <Text style={{ color: t.faint, fontSize: 12 }}>Reason</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {DISPUTE_REASONS.map((r) => {
              const active = reason === r;
              return (
                <Text
                  key={r}
                  onPress={() => setReason(r)}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? t.brand : t.surface, borderColor: active ? t.brand : t.line, color: active ? t.brandFg : t.fg },
                  ]}
                >
                  {humanize(r)}
                </Text>
              );
            })}
          </ScrollView>

          <TextField
            label={`Describe the issue (${DESCRIPTION_MIN}+ characters)`}
            value={description}
            onChangeText={setDescription}
            placeholder="What went wrong with this booking?"
            multiline
            error={error ?? (description && description.trim().length < DESCRIPTION_MIN ? `Add at least ${DESCRIPTION_MIN} characters` : undefined)}
          />
          <Button label="Submit dispute" onPress={() => create.mutate()} loading={create.isPending} disabled={!canSubmit} fullWidth />
        </Card>
      ) : null}

      <PaginatedList<Dispute>
        queryKey={['disputes']}
        fetchPage={(page) => listDisputes({ page })}
        keyExtractor={(d) => d.id}
        emptyTitle="No disputes"
        emptySubtitle="If something goes wrong with a booking, you can open a dispute here."
        itemHeight={110}
        renderItem={(d) => (
          <Card>
            <View style={styles.row}>
              <Text style={{ color: t.fgStrong, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                {d.bookingId}
              </Text>
              <Badge
                label={d.status}
                tone={d.status === 'RESOLVED' ? 'success' : d.status === 'OPEN' ? 'warn' : 'neutral'}
              />
            </View>
            <Text style={{ color: t.fg, marginTop: 4 }}>{humanize(d.reason)}</Text>
            {d.resolution ? (
              <Text style={{ color: t.muted, fontSize: 13, marginTop: 4 }}>Resolution: {d.resolution}</Text>
            ) : null}
            <Text style={{ color: t.faint, fontSize: 12, marginTop: 4 }}>{formatDate(d.createdAt)}</Text>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  heading: { fontSize: 22, fontWeight: '800' },
  form: { marginHorizontal: 16, gap: 10 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '600',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
