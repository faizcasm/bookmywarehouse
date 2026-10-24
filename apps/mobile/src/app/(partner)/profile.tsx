/** Partner business profile — editable business details. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { Button, Card, ErrorState, Screen, Skeleton, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getPartnerProfile, updatePartnerProfile } from '@/services/api/partner';

const FIELDS = [
  { key: 'businessName', label: 'Business name' },
  { key: 'displayName', label: 'Display name' },
  { key: 'contactPhone', label: 'Contact phone' },
  { key: 'contactEmail', label: 'Contact email' },
  { key: 'addressLine', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'description', label: 'About the business' },
] as const;

function toForm(profile: Record<string, unknown>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const f of FIELDS) {
    const val = profile[f.key];
    next[f.key] = val == null ? '' : String(val);
  }
  return next;
}

/** Keyed by the loaded profile so state initializes directly (no sync effect). */
function ProfileForm({ initial }: { initial: Record<string, string> }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);

  const save = useMutation({
    mutationFn: () => updatePartnerProfile(form),
    onSuccess: () => {
      Alert.alert('Saved', 'Your business profile has been updated.');
      qc.invalidateQueries({ queryKey: ['partner-profile'] });
    },
    onError: (e) => Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.'),
  });

  return (
    <>
      <Card style={{ gap: 12 }}>
        {FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={form[f.key] ?? ''}
            onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
            multiline={f.key === 'description'}
          />
        ))}
      </Card>
      <Button label="Save profile" onPress={() => save.mutate()} loading={save.isPending} fullWidth />
    </>
  );
}

export default function PartnerProfileScreen() {
  const t = useTheme();

  const profile = useQuery({ queryKey: ['partner-profile'], queryFn: getPartnerProfile });

  if (profile.isLoading) {
    return (
      <Screen scroll>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={60} radius={12} />
        ))}
      </Screen>
    );
  }
  if (profile.isError) {
    return (
      <Screen>
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      </Screen>
    );
  }

  const initial = profile.data?.profile ? toForm(profile.data.profile) : {};

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Business profile</Text>
      <ProfileForm key={JSON.stringify(initial)} initial={initial} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
});
