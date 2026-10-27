/**
 * Admin exports — generate a bookings or payouts CSV and hand it to the
 * native share sheet. (The API currently exposes only these two export
 * kinds.)
 */

import { useMutation } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Card, Screen, Segmented, type SegmentedOption } from '@/components/ui';
import { downloadExport } from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';

const KIND_OPTIONS: SegmentedOption[] = [
  { value: 'bookings', label: 'Bookings' },
  { value: 'payouts', label: 'Payouts' },
];

type Kind = 'bookings' | 'payouts';

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function AdminExportsScreen() {
  const t = useTheme();
  const { user } = useSession();
  const [kind, setKind] = useState<Kind>('bookings');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: async (selected: Kind) => {
      const csv = await downloadExport(selected);
      // Write the CSV to the cache dir, then hand the file to the OS share sheet.
      const file = new File(Paths.cache, `${selected}.csv`);
      if (file.exists) file.delete();
      file.create({ overwrite: true, intermediates: true });
      await file.write(csv);
      return { selected, uri: file.uri, rows: Math.max(0, csv.split('\n').length - 1) };
    },
    onSuccess: async ({ selected, uri, rows }) => {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${selected}`,
          UTI: 'public.comma-separated-values-text',
        });
        setSuccessMessage(`${selected}.csv (${rows} rows) is ready to share.`);
      } else {
        setSuccessMessage(`${selected}.csv (${rows} rows) was saved to the app cache.`);
      }
    },
  });

  if (!user) {
    return (
      <Screen scroll>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Export data</Text>
        <Banner tone="info" message="Sign in with an administrator account to export platform data." />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Export data</Text>
      <Text style={[styles.subheading, { color: t.muted }]}>
        Generate a CSV of platform data and hand it to your device share sheet so you can save or send it.
      </Text>

      {successMessage ? (
        <Banner tone="success" message={successMessage} actionLabel="Dismiss" onAction={() => setSuccessMessage(null)} />
      ) : null}

      <View style={styles.tabs}>
        <Segmented options={KIND_OPTIONS} value={kind} onChange={(next) => setKind(next as Kind)} />
      </View>

      <Card style={{ gap: 10 }}>
        <Text style={[styles.cardCopy, { color: t.muted }]}>
          {kind === 'bookings'
            ? 'Every booking on the platform with status, dates and totals.'
            : 'Partner payouts with amounts, status and settlement dates.'}
        </Text>
        <Button
          label={`Export ${kind}`}
          onPress={() => run.mutate(kind)}
          loading={run.isPending}
          fullWidth
        />
      </Card>

      {run.isError ? (
        <Banner
          tone="danger"
          message={messageFor(run.error)}
          actionLabel="Retry"
          onAction={() => run.mutate(kind)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  subheading: { fontSize: 13.5, lineHeight: 19, marginTop: -8 },
  tabs: { marginBottom: 4 },
  cardCopy: { fontSize: 13.5, lineHeight: 19 },
});
