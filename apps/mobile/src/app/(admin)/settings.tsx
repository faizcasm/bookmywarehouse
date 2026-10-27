/** Admin settings — editable platform settings (typed key/value, echo of server schema). */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { Button, Card, ErrorState, Screen, Skeleton, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getAdminSettings, updateAdminSettings, type PlatformSettings } from '@/services/api/admin';

type Scalar = string | number | boolean | null;
interface Entry {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean';
}

/** Build editable entries, remembering each value's original type for save. */
function toEntries(data: PlatformSettings): Entry[] {
  return Object.entries(data as Record<string, Scalar>)
    .filter(([, v]) => v === null || typeof v !== 'object')
    .map(([key, value]) => ({
      key,
      value: value == null ? '' : String(value),
      type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
    }));
}

function toPayload(entries: Entry[]): PlatformSettings {
  const payload: Record<string, Scalar> = {};
  for (const e of entries) {
    if (e.type === 'number') {
      const n = Number(e.value);
      if (Number.isFinite(n)) payload[e.key] = n;
    } else if (e.type === 'boolean') {
      payload[e.key] = e.value === 'true';
    } else if (e.value !== '') {
      payload[e.key] = e.value;
    }
  }
  return payload as PlatformSettings;
}

/** Keyed by the loaded settings so state initializes directly (no sync effect). */
function SettingsForm({ initial }: { initial: Entry[] }) {
  const t = useTheme();
  const qc = useQueryClient();
  const [entries, setEntries] = useState(initial);

  const save = useMutation({
    mutationFn: () => updateAdminSettings(toPayload(entries)),
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
              label={humanizeKey(e.key)}
              value={e.value}
              onChangeText={(v) =>
                setEntries((prev) => prev.map((p, idx) => (idx === i ? { ...p, value: v } : p)))
              }
              keyboardType={e.type === 'number' ? 'decimal-pad' : 'default'}
              placeholder={e.type === 'boolean' ? 'true / false' : undefined}
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

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
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
