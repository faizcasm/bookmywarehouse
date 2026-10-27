/**
 * Admin platform settings — structured form (fees, payouts, support, feature
 * flags) with dirty tracking. Money fields are edited in major units and
 * converted to minor on save; boolean flags toggle via LinkRow rows.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  ErrorState,
  LinkRow,
  Screen,
  SectionHeader,
  Skeleton,
  TextField,
} from '@/components/ui';
import { getAdminSettings, updateAdminSettings, type PlatformSettings } from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { formatMoney } from '@/utils/format';

interface SettingsFormState {
  currency: string;
  platformFeePercent: string;
  customerFeePercent: string;
  taxPercent: string;
  minPayoutMajor: string;
  supportEmail: string;
  announcement: string;
  allowSelfServiceListings: boolean;
  requirePartnerVerification: boolean;
  maintenanceMode: boolean;
}

function toFormState(s: PlatformSettings): SettingsFormState {
  return {
    currency: s.currency ?? 'INR',
    platformFeePercent: s.platformFeePercent != null ? String(s.platformFeePercent) : '',
    customerFeePercent: s.customerFeePercent != null ? String(s.customerFeePercent) : '',
    taxPercent: s.taxPercent != null ? String(s.taxPercent) : '',
    // Stored in minor units; edited here in major units.
    minPayoutMajor: s.minPayoutAmount != null ? (s.minPayoutAmount / 100).toFixed(2) : '',
    supportEmail: s.supportEmail ?? '',
    announcement: s.announcement ?? '',
    allowSelfServiceListings: s.allowSelfServiceListings ?? true,
    requirePartnerVerification: s.requirePartnerVerification ?? true,
    maintenanceMode: s.maintenanceMode ?? false,
  };
}

function percentError(value: string): string | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 50) return 'Enter a percentage between 0 and 50.';
  return undefined;
}

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

/** Mounted per loaded payload (keyed) so state starts from server values. */
function SettingsForm({ initial }: { initial: SettingsFormState }) {
  const t = useTheme();
  const qc = useQueryClient();
  const [form, setForm] = useState<SettingsFormState>(initial);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const set = <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const dirty = (Object.keys(initial) as (keyof SettingsFormState)[]).some(
    (key) => initial[key] !== form[key],
  );

  const payoutNumber = Number(form.minPayoutMajor);
  const payoutError =
    form.minPayoutMajor.trim() !== '' &&
    (!Number.isFinite(payoutNumber) || payoutNumber < 0)
      ? 'Enter a valid amount.'
      : undefined;

  const feeErrors = {
    platformFeePercent: percentError(form.platformFeePercent),
    customerFeePercent: percentError(form.customerFeePercent),
    taxPercent: percentError(form.taxPercent),
  };
  const emailError =
    form.supportEmail.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail.trim())
      ? 'Enter a valid email address.'
      : undefined;

  const hasErrors =
    payoutError != null || emailError != null || Object.values(feeErrors).some(Boolean);

  const save = useMutation({
    mutationFn: () =>
      updateAdminSettings({
        currency: form.currency.trim().toUpperCase(),
        ...(form.platformFeePercent.trim() !== ''
          ? { platformFeePercent: Number(form.platformFeePercent) }
          : {}),
        ...(form.customerFeePercent.trim() !== ''
          ? { customerFeePercent: Number(form.customerFeePercent) }
          : {}),
        ...(form.taxPercent.trim() !== '' ? { taxPercent: Number(form.taxPercent) } : {}),
        ...(form.minPayoutMajor.trim() !== ''
          ? // Major → minor units for the API.
            { minPayoutAmount: Math.round(payoutNumber * 100) }
          : {}),
        ...(form.supportEmail.trim() !== '' ? { supportEmail: form.supportEmail.trim() } : {}),
        announcement: form.announcement.trim() ? form.announcement.trim() : null,
        allowSelfServiceListings: form.allowSelfServiceListings,
        requirePartnerVerification: form.requirePartnerVerification,
        maintenanceMode: form.maintenanceMode,
      }),
    onSuccess: () => {
      setSuccessMessage('Settings saved.');
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });

  return (
    <View style={styles.form}>
      {successMessage ? (
        <Banner tone="success" message={successMessage} actionLabel="Dismiss" onAction={() => setSuccessMessage(null)} />
      ) : null}

      <SectionHeader title="Fees & payouts" />
      <Card style={styles.card}>
        <TextField
          label="Currency"
          value={form.currency}
          onChangeText={(v) => set('currency', v)}
          autoCapitalize="characters"
          maxLength={3}
          hint="ISO 4217 code, e.g. INR."
        />
        <TextField
          label="Platform fee (%)"
          value={form.platformFeePercent}
          onChangeText={(v) => set('platformFeePercent', v)}
          keyboardType="decimal-pad"
          placeholder="0"
          error={feeErrors.platformFeePercent}
        />
        <TextField
          label="Customer fee (%)"
          value={form.customerFeePercent}
          onChangeText={(v) => set('customerFeePercent', v)}
          keyboardType="decimal-pad"
          placeholder="0"
          error={feeErrors.customerFeePercent}
        />
        <TextField
          label="Tax (%)"
          value={form.taxPercent}
          onChangeText={(v) => set('taxPercent', v)}
          keyboardType="decimal-pad"
          placeholder="0"
          error={feeErrors.taxPercent}
        />
        <TextField
          label="Minimum payout"
          value={form.minPayoutMajor}
          onChangeText={(v) => set('minPayoutMajor', v)}
          keyboardType="decimal-pad"
          placeholder="0"
          error={payoutError}
          hint={
            form.minPayoutMajor.trim() !== '' && !payoutError && Number.isFinite(payoutNumber)
              ? `Partners are paid once their balance passes ${formatMoney(Math.round(payoutNumber * 100), form.currency.trim().toUpperCase() || 'INR')}.`
              : 'Partners are paid once their balance passes this amount.'
          }
        />
      </Card>

      <SectionHeader title="Support" />
      <Card style={styles.card}>
        <TextField
          label="Support email"
          value={form.supportEmail}
          onChangeText={(v) => set('supportEmail', v)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={emailError}
        />
        <TextField
          label="Announcement"
          value={form.announcement}
          onChangeText={(v) => set('announcement', v)}
          placeholder="Shown as a banner across the app"
          multiline
          hint="Leave empty to remove the announcement."
        />
      </Card>

      <SectionHeader title="Platform behaviour" />
      <Card padded={false}>
        <LinkRow
          label="Self-service listings"
          subtitle="Partners can publish listings without admin approval"
          value={form.allowSelfServiceListings ? 'On' : 'Off'}
          hideChevron
          onPress={() => set('allowSelfServiceListings', !form.allowSelfServiceListings)}
        />
        <LinkRow
          label="Require partner verification"
          subtitle="Verified partners only can take bookings"
          value={form.requirePartnerVerification ? 'On' : 'Off'}
          hideChevron
          onPress={() => set('requirePartnerVerification', !form.requirePartnerVerification)}
        />
        <LinkRow
          label="Maintenance mode"
          subtitle="Blocks buyer checkout while platform work continues"
          value={form.maintenanceMode ? 'On' : 'Off'}
          danger={form.maintenanceMode}
          hideChevron
          onPress={() => set('maintenanceMode', !form.maintenanceMode)}
        />
      </Card>

      {save.isError ? <Banner tone="danger" message={messageFor(save.error)} /> : null}

      <Button
        label="Save settings"
        fullWidth
        disabled={!dirty || hasErrors}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
      {!dirty && !save.isPending ? (
        <Text style={[styles.footnote, { color: t.faint }]}>No changes to save.</Text>
      ) : null}
    </View>
  );
}

export default function AdminSettingsScreen() {
  const t = useTheme();
  const { user } = useSession();

  const settings = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getAdminSettings,
    enabled: !!user,
  });

  if (!user) {
    return (
      <Screen scroll>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Settings</Text>
        <Banner tone="info" message="Sign in with an administrator account to manage platform settings." />
      </Screen>
    );
  }

  if (settings.isLoading) {
    return (
      <Screen scroll>
        <Text style={[styles.heading, { color: t.fgStrong }]}>Settings</Text>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={96} radius={12} />
        ))}
      </Screen>
    );
  }

  if (settings.isError || !settings.data) {
    return (
      <Screen>
        <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
      </Screen>
    );
  }

  const initial = toFormState(settings.data);

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Settings</Text>
      <SettingsForm key={JSON.stringify(initial)} initial={initial} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  form: { gap: 16 },
  card: { gap: 12 },
  footnote: { fontSize: 12.5, textAlign: 'center' },
});
