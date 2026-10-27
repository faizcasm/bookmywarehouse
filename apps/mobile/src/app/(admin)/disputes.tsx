/** Admin disputes — resolve open disputes with an outcome + note. */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Button, Card, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAdminDisputes, resolveDispute, type AdminDisputeRow, type DisputeResolution } from '@/services/api/admin';
import { formatDate, humanize } from '@/utils/format';

const RESOLUTIONS: DisputeResolution[] = ['RESOLVED_CUSTOMER', 'RESOLVED_PARTNER', 'CLOSED'];
const NOTE_MIN = 5;

export default function AdminDisputesScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<DisputeResolution>('RESOLVED_CUSTOMER');
  const [note, setNote] = useState('');

  const resolve = useMutation({
    mutationFn: ({ id }: { id: string }) => resolveDispute(id, resolution, note.trim()),
    onSuccess: () => {
      Alert.alert('Dispute resolved');
      setActiveId(null);
      setNote('');
      qc.invalidateQueries({ queryKey: ['admin-disputes'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (e) => Alert.alert('Could not resolve', e instanceof Error ? e.message : 'Try again.'),
  });

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Disputes</Text>
      <PaginatedList<AdminDisputeRow>
        queryKey={['admin-disputes']}
        fetchPage={(page) => listAdminDisputes({ page, limit: 20 })}
        keyExtractor={(d) => d.id}
        emptyTitle="No disputes"
        emptySubtitle="Customer disputes will appear here."
        itemHeight={180}
        renderItem={(d) => (
          <Card style={{ gap: 8 }}>
            <View style={styles.row}>
              <Text style={{ color: t.fgStrong, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {d.bookingId ?? d.id}
              </Text>
              <Badge
                label={d.status ?? 'OPEN'}
                tone={d.status === 'RESOLVED' ? 'success' : d.status === 'OPEN' ? 'warn' : 'neutral'}
              />
            </View>
            <Text style={{ color: t.fg }}>{humanize(d.reason ?? '')}</Text>
            <Text style={{ color: t.faint, fontSize: 12 }}>{formatDate(d.createdAt)}</Text>
            {d.status === 'OPEN' ? (
              activeId === d.id ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: t.faint, fontSize: 12 }}>Outcome</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {RESOLUTIONS.map((r) => {
                      const active = resolution === r;
                      return (
                        <Text
                          key={r}
                          onPress={() => setResolution(r)}
                          style={[styles.chip, { backgroundColor: active ? t.brand : t.surface, borderColor: active ? t.brand : t.line, color: active ? t.brandFg : t.fg }]}
                        >
                          {humanize(r)}
                        </Text>
                      );
                    })}
                  </ScrollView>
                  <TextField
                    label="Resolution note"
                    value={note}
                    onChangeText={setNote}
                    placeholder="Explain the outcome"
                    multiline
                    error={note && note.trim().length < NOTE_MIN ? `At least ${NOTE_MIN} characters` : undefined}
                  />
                  <Button
                    label="Resolve dispute"
                    onPress={() => resolve.mutate({ id: d.id })}
                    loading={resolve.isPending}
                    disabled={note.trim().length < NOTE_MIN}
                    fullWidth
                  />
                </View>
              ) : (
                <Button label="Resolve" onPress={() => setActiveId(d.id)} />
              )
            ) : null}
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  heading: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, overflow: 'hidden', fontSize: 12, fontWeight: '600' },
});
