/** Partner business profile — create/update via the onboarding contract. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { Button, Card, ErrorState, Screen, Skeleton, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getPartnerProfile, onboardPartner, type OnboardingInput } from '@/services/api/partner';

interface FormState {
  businessName: string;
  description: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  website: string;
}

const EMPTY: FormState = {
  businessName: '',
  description: '',
  addressLine1: '',
  city: '',
  state: '',
  postalCode: '',
  website: '',
};

function toForm(p: {
  businessName?: string;
  description?: string | null;
  website?: string | null;
  address?: { addressLine1?: string; city?: string; state?: string; postalCode?: string } | null;
}): FormState {
  return {
    businessName: p.businessName ?? '',
    description: p.description ?? '',
    addressLine1: p.address?.addressLine1 ?? '',
    city: p.address?.city ?? '',
    state: p.address?.state ?? '',
    postalCode: p.address?.postalCode ?? '',
    website: p.website ?? '',
  };
}

/** Keyed by the loaded profile so state initializes directly (no sync effect). */
function ProfileForm({ initial }: { initial: FormState }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const payload: OnboardingInput = {
        businessName: form.businessName.trim(),
        businessType: 'SOLE_PROPRIETORSHIP',
        description: form.description.trim() || null,
        address: {
          addressLine1: form.addressLine1.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
          country: 'India',
        },
        website: form.website.trim() || null,
        supportedTypes: ['WAREHOUSE'],
      };
      return onboardPartner(payload);
    },
    onSuccess: () => {
      Alert.alert('Saved', 'Your business profile has been updated.');
      qc.invalidateQueries({ queryKey: ['partner-profile'] });
    },
    onError: (e) => Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.'),
  });

  const valid =
    form.businessName.trim().length >= 2 &&
    form.addressLine1.trim().length >= 2 &&
    form.city.trim().length >= 1 &&
    form.state.trim().length >= 1 &&
    /^[0-9]{6}$/.test(form.postalCode.trim());

  return (
    <>
      <Card style={{ gap: 12 }}>
        <TextField label="Business name" value={form.businessName} onChangeText={set('businessName')} />
        <TextField label="Address" value={form.addressLine1} onChangeText={set('addressLine1')} multiline />
        <TextField label="City" value={form.city} onChangeText={set('city')} />
        <TextField label="State" value={form.state} onChangeText={set('state')} />
        <TextField
          label="Pincode"
          value={form.postalCode}
          onChangeText={set('postalCode')}
          keyboardType="numeric"
          maxLength={6}
          error={form.postalCode && !/^[0-9]{6}$/.test(form.postalCode) ? 'Enter a 6-digit pincode' : undefined}
        />
        <TextField
          label="Website (optional)"
          value={form.website}
          onChangeText={set('website')}
          autoCapitalize="none"
          placeholder="https://…"
        />
        <TextField label="About the business" value={form.description} onChangeText={set('description')} multiline />
      </Card>
      <Button label="Save profile" onPress={() => save.mutate()} loading={save.isPending} disabled={!valid} fullWidth />
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

  const initial = profile.data ? toForm(profile.data) : EMPTY;

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
