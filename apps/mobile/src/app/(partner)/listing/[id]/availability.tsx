/** Partner availability — view and block/unblock dates for a listing. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, Screen, Skeleton, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAvailability, setAvailability } from '@/services/api/partner';
import { formatDayLabel, formatMoney } from '@/utils/format';

export default function AvailabilityScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [date, setDate] = useState('');

  const slots = useQuery({
    queryKey: ['availability', id],
    queryFn: () => listAvailability(id!),
    enabled: !!id,
  });

  const block = useMutation({
    mutationFn: () =>
      setAvailability(id!, { rules: [{ date: date.trim(), available: false }] }),
    onSuccess: () => {
      Alert.alert('Date blocked', `${date} is now unavailable.`);
      setDate('');
      qc.invalidateQueries({ queryKey: ['availability', id] });
    },
    onError: (e) => Alert.alert('Could not block', e instanceof Error ? e.message : 'Try again.'),
  });

  if (slots.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={120} radius={16} />
      </Screen>
    );
  }
  if (slots.isError) {
    return (
      <Screen>
        <ErrorState error={slots.error} onRetry={() => slots.refetch()} />
      </Screen>
    );
  }

  const items = slots.data ?? [];

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
          error={date && !/^\d{4}-\d{2}-\d{2}$/.test(date) ? 'Use YYYY-MM-DD' : undefined}
        />
        <Button
          label="Block date"
          onPress={() => block.mutate()}
          loading={block.isPending}
          disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date)}
          fullWidth
        />
      </Card>

      <Text style={[styles.sectionTitle, { color: t.fgStrong }]}>Current schedule</Text>
      {items.length ? (
        <View style={{ gap: 10 }}>
          {items.map((slot) => (
            <Card key={slot.date}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.fgStrong, fontWeight: '600' }}>{formatDayLabel(slot.date)}</Text>
                  {slot.priceMinor != null ? (
                    <Text style={{ color: t.muted, fontSize: 13 }}>{formatMoney(slot.priceMinor)}</Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: slot.available ? t.successSoft : t.neutralSoft },
                  ]}
                >
                  <Text style={{ color: slot.available ? t.successSoftFg : t.neutralSoftFg, fontWeight: '600', fontSize: 12 }}>
                    {slot.available ? 'Open' : 'Blocked'}
                  </Text>
                </View>
              </View>
              {!slot.available && slot.blockedReason ? (
                <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>{slot.blockedReason}</Text>
              ) : null}
            </Card>
          ))}
        </View>
      ) : (
        <Card>
          <Text style={{ color: t.muted }}>No availability rules set. The listing is treated as always open by default.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
});
