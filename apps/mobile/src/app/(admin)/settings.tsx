/** Admin settings — editable platform settings (key/value). */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { Button, Card, ErrorState, Screen, Skeleton, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getAdminSettings, updateAdminSettings } from '@/services/api/admin';

function toEntries(data: Record<string, unknown>): Array<{ key: string; value: string }> {
  return Object.entries(data).map(([key, value]) => ({
    key,
    value: value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value),
  }));
}

/** Keyed by the loaded settings so state initializes directly (no sync effect). */
function SettingsForm({ initial }: { initial: Array<{ key: string; value: string }> }) {
  const t = useTheme();
  const qc = useQueryClient();
  const [entries, setEntries] = useState(initial);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      for (const e of entries) {
        payload[e.key] = e.value;
      }
      return updateAdminSettings(payload);
    },
    onSuccess: () => {
      Alert.alert('Settings saved');
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (e) => Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.'),
  });

  return (
    <>
      <Card style={{ gap: 12 }}>
        {entries.length ? (
          entries.map((e, i) => (
            <TextField
              key={e.key}
              label={e.key}
              value={e.value}
              onChangeText={(v) =>
                setEntries((prev) => prev.map((p, idx) => (idx === i ? { ...p, value: v } : p)))
              }
            />
          ))
        ) : (
          <Text style={{ color: t.muted }}>No configurable settings returned by the server.</Text>
        )}
      </Card>
      {entries.length ? (
        <Button label="Save settings" onPress={() => save.mutate()} loading={save.isPending} fullWidth />
      ) : null}
    </>
  );
}

export default function AdminSettingsScreen() {
  const t = useTheme();

  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: getAdminSettings });

  if (settings.isLoading) {
    return (
      <Screen scroll>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={60} radius={12} />
        ))}
      </Screen>
    );
  }
  if (settings.isError) {
    return (
      <Screen>
        <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
      </Screen>
    );
  }

  const initial = settings.data ? toEntries(settings.data) : [];

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Settings</Text>
      <SettingsForm key={JSON.stringify(initial)} initial={initial} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
});
