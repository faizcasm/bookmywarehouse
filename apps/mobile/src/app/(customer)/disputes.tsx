/** Disputes — list + open a new dispute against a booking. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Button, Card, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listDisputes, createDispute } from '@/services/api/account';
import { listBookings } from '@/services/api/bookings';
import { formatDate } from '@/utils/format';
import type { Dispute } from '@/types';

export default function DisputesScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const bookings = useQuery({ queryKey: ['bookings-for-dispute'], queryFn: () => listBookings({}) });

  const create = useMutation({
    mutationFn: () => createDispute({ bookingId: bookingId.trim(), reason: reason.trim() }),
    onSuccess: () => {
      Alert.alert('Dispute opened', "We'll review it and get back to you.");
      setBookingId('');
      setReason('');
      setOpen(false);
      setError(null);
      qc.invalidateQueries({ queryKey: ['disputes'] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not open the dispute.'),
  });

  return (
    <Screen padTop={false} style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Disputes</Text>
        <Button label={open ? 'Close' : 'New dispute'} variant="secondary" onPress={() => setOpen((o) => !o)} />
      </View>

      {open ? (
        <Card style={styles.form}>
          <Text style={{ color: t.fg, fontWeight: '600' }}>Open a dispute</Text>
          <Text style={{ color: t.faint, fontSize: 12 }}>
            {bookings.data?.items?.length ?? 0} bookings available
          </Text>
          <TextField
            label="Booking ID"
            value={bookingId}
            onChangeText={setBookingId}
            placeholder="Booking to dispute"
            autoCapitalize="none"
          />
          <TextField
            label="Reason"
            value={reason}
            onChangeText={setReason}
            placeholder="Describe the issue"
            multiline
            error={error ?? undefined}
          />
          <Button label="Submit dispute" onPress={() => create.mutate()} loading={create.isPending} fullWidth />
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
            <Text style={{ color: t.fg, marginTop: 4 }}>{d.reason}</Text>
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
  form: { marginHorizontal: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
