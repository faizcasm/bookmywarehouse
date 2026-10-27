/** Partner availability — view blocked dates and block/unblock a specific date. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, Screen, Skeleton, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import {
  getListingAvailability,
  addAvailabilityException,
  removeAvailabilityException,
} from '@/services/api/partner';
import { formatDayLabel } from '@/utils/format';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function AvailabilityScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  const availability = useQuery({
    queryKey: ['availability', id],
    queryFn: () => getListingAvailability(id!),
    enabled: !!id,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['availability', id] });

  const block = useMutation({
    mutationFn: () =>
      addAvailabilityException({
        listingId: id!,
        date: date.trim(),
        reason: reason.trim() || null,
        isAvailable: false,
      }),
    onSuccess: () => {
      Alert.alert('Date blocked', `${date} is now unavailable.`);
      setDate('');
      setReason('');
      invalidate();
    },
    onError: (e) => Alert.alert('Could not block', e instanceof Error ? e.message : 'Try again.'),
  });

  const unblock = useMutation({
    mutationFn: (exceptionId: string) => removeAvailabilityException(exceptionId),
    onSuccess: () => {
      Alert.alert('Date opened', 'The date is available again.');
      invalidate();
    },
    onError: (e) => Alert.alert('Could not open', e instanceof Error ? e.message : 'Try again.'),
  });

  if (availability.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={120} radius={16} />
      </Screen>
    );
  }
  if (availability.isError) {
    return (
      <Screen>
        <ErrorState error={availability.error} onRetry={() => availability.refetch()} />
      </Screen>
    );
  }

  const blocked = availability.data?.blockedDates ?? [];
  const rules = availability.data?.rules ?? [];

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Availability</Text>
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </View>

      <Card style={{ gap: 12 }}>
        <Text style={{ color: t.fgStrong, fontWeight: '700' }}>Block a date</Text>
        <TextField
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          placeholder="2026-01-15"
          autoCapitalize="none"
          error={date && !DATE_RE.test(date) ? 'Use YYYY-MM-DD' : undefined}
        />
        <TextField label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="Maintenance, private use…" />
        <Button
          label="Block date"
          onPress={() => block.mutate()}
          loading={block.isPending}
          disabled={!DATE_RE.test(date)}
          fullWidth
        />
      </Card>

      <Text style={[styles.sectionTitle, { color: t.fgStrong }]}>Blocked dates</Text>
      {blocked.length ? (
        <View style={{ gap: 10 }}>
          {blocked.map((ex) => (
            <Card key={ex.id ?? ex.date}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.fgStrong, fontWeight: '600' }}>{formatDayLabel(ex.date)}</Text>
                  {ex.reason ? <Text style={{ color: t.muted, fontSize: 12 }}>{ex.reason}</Text> : null}
                </View>
                <Button label="Open" variant="ghost" onPress={() => unblock.mutate(ex.id!)} loading={unblock.isPending} />
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <Card>
          <Text style={{ color: t.muted }}>No blocked dates. The listing follows its weekly rules (below).</Text>
        </Card>
      )}

      <Text style={[styles.sectionTitle, { color: t.fgStrong }]}>Weekly rules</Text>
      {rules.length ? (
        <View style={{ gap: 10 }}>
          {rules.map((r) => (
            <Card key={r.id}>
              <Text style={{ color: t.fgStrong, fontWeight: '600' }}>
                {r.daysOfWeek.map(dayName).join(', ')}
              </Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>
                {r.startTime}–{r.endTime}
              </Text>
            </Card>
          ))}
        </View>
      ) : (
        <Card>
          <Text style={{ color: t.muted }}>No weekly rules. The listing is treated as always open by default.</Text>
        </Card>
      )}
    </Screen>
  );
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayName = (d: number) => DAYS[d] ?? String(d);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
