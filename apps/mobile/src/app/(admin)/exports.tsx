/** Admin exports — generate a CSV export and share it via the native sheet. */

import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';

import { Button, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { downloadExport } from '@/services/api/admin';

const KINDS = ['users', 'bookings', 'payments'] as const;
type Kind = (typeof KINDS)[number];

export default function AdminExportsScreen() {
  const t = useTheme();
  const [selected, setSelected] = useState<Kind>('users');

  const run = useMutation({
    mutationFn: async (kind: Kind) => {
      const csv = await downloadExport(kind);
      return { kind, csv };
    },
    onSuccess: async ({ kind, csv }) => {
      // Hand the CSV to the OS share sheet so it can be saved/messaged out.
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        Alert.alert('Export ready', `${kind}.csv has been generated (${csv.length} characters). Use your device share options to save it.`);
      } else {
        Alert.alert('Export ready', `${kind}.csv has been generated (${csv.length} characters).`);
      }
    },
    onError: (e) => Alert.alert('Export failed', e instanceof Error ? e.message : 'Try again.'),
  });

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Export data</Text>
      <Text style={{ color: t.muted }}>
        Generate a CSV of platform data. On the web console this downloads a blob; here it is produced and handed to
        your device share sheet so you can save or send it.
      </Text>

      <View style={styles.chipRow}>
        {KINDS.map((kind) => {
          const active = selected === kind;
          return (
            <Text
              key={kind}
              onPress={() => setSelected(kind)}
              style={[
                styles.chip,
                { backgroundColor: active ? t.brand : t.surface, borderColor: active ? t.brand : t.line, color: active ? t.brandFg : t.fg },
              ]}
            >
              {kind.charAt(0).toUpperCase() + kind.slice(1)}
            </Text>
          );
        })}
      </View>

      <Card>
        <Button
          label={`Export ${selected}`}
          onPress={() => run.mutate(selected)}
          loading={run.isPending}
          fullWidth
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, overflow: 'hidden', fontSize: 14, fontWeight: '600' },
});
