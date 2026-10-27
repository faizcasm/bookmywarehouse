/** Admin exports — generate a CSV export and share it via the native sheet. */

import { useMutation } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { downloadExport } from '@/services/api/admin';

const KINDS = ['bookings', 'payouts'] as const;
type Kind = (typeof KINDS)[number];

export default function AdminExportsScreen() {
  const t = useTheme();
  const [selected, setSelected] = useState<Kind>('bookings');

  const run = useMutation({
    mutationFn: async (kind: Kind) => {
      const csv = await downloadExport(kind);
      // Write the CSV to the cache dir, then hand the file to the OS share sheet.
      const file = new File(Paths.cache, `${kind}.csv`);
      try {
        if (file.exists) file.delete();
      } catch {
        /* ignore — create below overwrites */
      }
      file.create({ overwrite: true, intermediates: true });
      await file.write(csv);
      return { kind, uri: file.uri, rows: csv.split('\n').length };
    },
    onSuccess: async ({ kind, uri, rows }) => {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${kind}`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Export ready', `${kind}.csv (${rows} rows) was saved to the app cache.`);
      }
    },
    onError: (e) => Alert.alert('Export failed', e instanceof Error ? e.message : 'Try again.'),
  });

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Export data</Text>
      <Text style={{ color: t.muted }}>
        Generate a CSV of platform data and hand it to your device share sheet so you can save or send it.
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
