/** Admin disputes — resolve open disputes. */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Button, Card, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAdminDisputes, resolveDispute } from '@/services/api/admin';
import { formatDate } from '@/utils/format';

interface DisputeRow {
  id: string;
  bookingId: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function AdminDisputesScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');

  const resolve = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => resolveDispute(id, text),
    onSuccess: () => {
      Alert.alert('Dispute resolved');
      setActiveId(null);
      setResolution('');
      qc.invalidateQueries({ queryKey: ['admin-disputes'] });
      qc.invalidateQueries({ queryKey: ['admin-open-disputes'] });
    },
    onError: (e) => Alert.alert('Could not resolve', e instanceof Error ? e.message : 'Try again.'),
  });

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Disputes</Text>
      <PaginatedList<DisputeRow>
        queryKey={['admin-disputes']}
        fetchPage={(page) => listAdminDisputes<DisputeRow>({ page, limit: 20 })}
        keyExtractor={(d) => d.id}
        emptyTitle="No disputes"
        emptySubtitle="Customer disputes will appear here."
        itemHeight={160}
        renderItem={(d) => (
          <Card style={{ gap: 8 }}>
            <View style={styles.row}>
              <Text style={{ color: t.fgStrong, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {d.bookingId}
              </Text>
              <Badge
                label={d.status}
                tone={d.status === 'RESOLVED' ? 'success' : d.status === 'OPEN' ? 'warn' : 'neutral'}
              />
            </View>
            <Text style={{ color: t.fg }}>{d.reason}</Text>
            <Text style={{ color: t.faint, fontSize: 12 }}>{formatDate(d.createdAt)}</Text>
            {d.status === 'OPEN' ? (
              activeId === d.id ? (
                <View style={{ gap: 8 }}>
                  <TextField
                    label="Resolution"
                    value={resolution}
                    onChangeText={setResolution}
                    placeholder="Explain the outcome"
                    multiline
                  />
                  <Button
                    label="Resolve dispute"
                    onPress={() => resolve.mutate({ id: d.id, text: resolution.trim() })}
                    loading={resolve.isPending}
                    disabled={!resolution.trim()}
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
});
