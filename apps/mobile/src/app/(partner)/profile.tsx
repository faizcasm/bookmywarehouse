/**
 * Partner business profile — read + edit the onboarding contract
 * (POST /partner/onboarding is the create *and* update path).
 *
 * All fields the endpoint accepts are edited here as one form, so saving sends
 * the complete payload rather than a partial patch that could drop the
 * address or supported listing types.
 */

import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ArrowLeft, ImagePlus, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Badge,
  Banner,
  Button,
  Card,
  ErrorState,
  KeyValue,
  Screen,
  SectionHeader,
  SignInPrompt,
  Skeleton,
  TextField,
} from '@/components/ui';
import { ApiError } from '@/services/api/client';
import {
  getPartnerProfile,
  onboardPartner,
  type OnboardingInput,
} from '@/services/api/partner';
import { uploadFile, uriToDataUri } from '@/services/api/uploads';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { VERIFICATION_STATUS_META, formatNumber, formatDate, humanize } from '@/utils/format';

const BUSINESS_TYPES = [
  { value: 'SOLE_PROPRIETORSHIP', label: 'Sole proprietor' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'PRIVATE_LIMITED', label: 'Private ltd' },
  { value: 'PUBLIC_LIMITED', label: 'Public ltd' },
  { value: 'LLP', label: 'LLP' },
  { value: 'HUF', label: 'HUF' },
  { value: 'OTHER', label: 'Other' },
] as const;

const LISTING_TYPES = [
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SERVICE', label: 'Service' },
] as const;

type ListingTypeValue = (typeof LISTING_TYPES)[number]['value'];

interface FormState {
  businessName: string;
  businessType: string;
  description: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  website: string;
  logoUrl: string | null;
  supportedTypes: ListingTypeValue[];
}

interface ProfileLike {
  businessName?: string;
  businessType?: string | null;
  description?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  address?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
}

function toForm(profile: ProfileLike): FormState {
  return {
    businessName: profile.businessName ?? '',
    businessType: profile.businessType ?? 'SOLE_PROPRIETORSHIP',
    description: profile.description ?? '',
    addressLine1: profile.address?.addressLine1 ?? '',
    city: profile.address?.city ?? '',
    state: profile.address?.state ?? '',
    postalCode: profile.address?.postalCode ?? '',
    website: profile.website ?? '',
    logoUrl: profile.logoUrl ?? null,
    // The profile endpoint doesn't expose supportedTypes, so default to every
    // type the console can create rather than silently narrowing to one.
    supportedTypes: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'],
  };
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.businessName.trim().length < 2) errors.businessName = 'Business name is required.';
  if (form.businessName.trim().length > 120) errors.businessName = 'Keep it under 120 characters.';
  if (form.addressLine1.trim().length < 3) errors.addressLine1 = 'Enter the full address.';
  if (form.city.trim().length < 2) errors.city = 'Enter the city.';
  if (form.state.trim().length < 2) errors.state = 'Enter the state.';
  if (!/^[0-9A-Za-z -]{4,12}$/.test(form.postalCode.trim())) {
    errors.postalCode = 'Enter a valid postal / PIN code.';
  }
  if (form.website.trim() !== '' && !/^https?:\/\/\S+$/.test(form.website.trim())) {
    errors.website = 'Website must start with http:// or https://';
  }
  if (form.description.trim().length > 2000) {
    errors.description = 'Keep the description under 2000 characters.';
  }
  if (form.supportedTypes.length === 0) {
    errors.supportedTypes = 'Select at least one listing type.';
  }
  return errors;
}

function ProfileForm({ initial }: { initial: FormState }) {
  const t = useTheme();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>(initial);
  const [logoBusy, setLogoBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const set = (key: keyof FormState) => (value: FormState[keyof FormState]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const save = useMutation({
    mutationFn: () => {
      const payload: OnboardingInput = {
        businessName: form.businessName.trim(),
        businessType: form.businessType,
        description: form.description.trim() === '' ? null : form.description.trim(),
        address: {
          addressLine1: form.addressLine1.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
          country: 'India',
        },
        website: form.website.trim() === '' ? null : form.website.trim(),
        logoUrl: form.logoUrl,
        supportedTypes: form.supportedTypes,
      };
      return onboardPartner(payload);
    },
    onSuccess: () => {
      setFormError(null);
      setNotice('Business profile saved.');
      qc.invalidateQueries({ queryKey: ['partner-profile'] });
      qc.invalidateQueries({ queryKey: ['verification'] });
    },
    onError: (e) => {
      setNotice(null);
      if (e instanceof ApiError && e.issues.length) {
        setFormError(e.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
      } else {
        setFormError(e instanceof Error ? e.message : 'Could not save the profile. Try again.');
      }
    },
  });

  const pickLogo = async () => {
    if (logoBusy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setFormError('Allow photo access in Settings to upload a logo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      setLogoBusy(true);
      setFormError(null);
      const uploaded = await uploadFile({ file: await uriToDataUri(asset.uri), folder: 'logos' });
      setForm((current) => ({ ...current, logoUrl: uploaded.url }));
      setNotice(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not upload the logo.');
    } finally {
      setLogoBusy(false);
    }
  };

  const submit = () => {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    save.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {notice ? (
        <Banner tone="success" message={notice} actionLabel="Dismiss" onAction={() => setNotice(null)} />
      ) : null}
      {formError ? <Banner tone="danger" message={formError} /> : null}

      <SectionHeader title="Logo" />
      <View style={styles.logoRow}>
        {form.logoUrl ? (
          <View style={styles.logoWrap}>
            <Image
              source={{ uri: form.logoUrl }}
              style={[styles.logo, { backgroundColor: t.surface3 }]}
              contentFit="cover"
              transition={150}
              accessibilityLabel="Business logo"
            />
            <Pressable
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Remove logo"
              disabled={logoBusy}
              onPress={() => {
                setForm((current) => ({ ...current, logoUrl: null }));
                setNotice(null);
              }}
              style={[styles.logoRemove, { backgroundColor: 'rgba(2,6,23,0.6)' }]}
            >
              <X size={14} color="#ffffff" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Upload logo"
            disabled={logoBusy}
            onPress={() => void pickLogo()}
            style={[styles.logo, styles.logoAdd, { borderColor: t.lineStrong }]}
          >
            {logoBusy ? (
              <ActivityIndicator color={t.brand} />
            ) : (
              <ImagePlus size={22} color={t.brand} />
            )}
          </Pressable>
        )}
        <View style={styles.logoCopy}>
          <Text style={{ color: t.fg, fontSize: 14, fontWeight: '600' }}>
            {form.logoUrl ? 'Logo uploaded' : 'No logo yet'}
          </Text>
          <Text style={{ color: t.muted, fontSize: 12.5, lineHeight: 17 }}>
            Square image, up to 1 MB. Shown to customers on your listings.
          </Text>
          {form.logoUrl ? (
            <Button label={logoBusy ? 'Uploading…' : 'Change logo'} variant="ghost" loading={logoBusy} onPress={() => void pickLogo()} />
          ) : null}
        </View>
      </View>

      <SectionHeader title="Business details" />
      <TextField
        label="Business name"
        value={form.businessName}
        onChangeText={set('businessName')}
        error={errors.businessName}
        placeholder="e.g. Sunrise Warehousing Pvt Ltd"
        accessibilityLabel="Business name"
        maxLength={120}
      />
      <Text style={[styles.chipLabel, { color: t.fg }]}>Business type</Text>
      <View style={styles.chipRow}>
        {BUSINESS_TYPES.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: form.businessType === option.value }}
            onPress={() => set('businessType')(option.value)}
            style={[
              styles.chip,
              {
                backgroundColor: form.businessType === option.value ? t.brandSoft : t.surface,
                borderColor: form.businessType === option.value ? t.brand : t.line,
              },
            ]}
          >
            <Text
              style={{
                color: form.businessType === option.value ? t.brandSoftFg : t.fg,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.chipLabel, { color: t.fg }]}>Listing types you accept</Text>
      <View style={styles.chipRow}>
        {LISTING_TYPES.map((option) => {
          const active = form.supportedTypes.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() =>
                set('supportedTypes')(
                  active
                    ? form.supportedTypes.filter((value) => value !== option.value)
                    : [...form.supportedTypes, option.value],
                )
              }
              style={[
                styles.chip,
                {
                  backgroundColor: active ? t.brandSoft : t.surface,
                  borderColor: active ? t.brand : t.line,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? t.brandSoftFg : t.fg,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {errors.supportedTypes ? (
        <Text style={[styles.error, { color: t.danger }]}>{errors.supportedTypes}</Text>
      ) : null}
      <TextField
        label="About the business"
        value={form.description}
        onChangeText={set('description')}
        error={errors.description}
        multiline
        placeholder="What you operate, capacity, who you serve…"
        accessibilityLabel="About the business"
        maxLength={2000}
      />
      <TextField
        label="Website (optional)"
        value={form.website}
        onChangeText={set('website')}
        error={errors.website}
        autoCapitalize="none"
        placeholder="https://…"
        accessibilityLabel="Website"
      />

      <SectionHeader title="Address" />
      <TextField
        label="Address"
        value={form.addressLine1}
        onChangeText={set('addressLine1')}
        error={errors.addressLine1}
        multiline
        placeholder="Street, area, landmark"
        accessibilityLabel="Business address"
        maxLength={200}
      />
      <View style={styles.rowGap}>
        <View style={styles.flex}>
          <TextField
            label="City"
            value={form.city}
            onChangeText={set('city')}
            error={errors.city}
            placeholder="Mumbai"
            accessibilityLabel="City"
            maxLength={80}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="State"
            value={form.state}
            onChangeText={set('state')}
            error={errors.state}
            placeholder="Maharashtra"
            accessibilityLabel="State"
            maxLength={80}
          />
        </View>
      </View>
      <TextField
        label="Postal code"
        value={form.postalCode}
        onChangeText={set('postalCode')}
        error={errors.postalCode}
        keyboardType="number-pad"
        placeholder="400001"
        accessibilityLabel="Postal code"
        maxLength={12}
      />

      <View style={styles.actions}>
        <Button
          label={save.isPending ? 'Saving…' : 'Save profile'}
          onPress={submit}
          loading={save.isPending}
          disabled={save.isPending || logoBusy}
          fullWidth
        />
      </View>
    </KeyboardAvoidingView>
  );
}

export default function PartnerProfileScreen() {
  const t = useTheme();
  const { user } = useSession();

  const profile = useQuery({
    queryKey: ['partner-profile'],
    queryFn: getPartnerProfile,
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to edit your profile"
          subtitle="Your business details are part of your partner account."
          next="/(partner)/profile"
        />
      </Screen>
    );
  }

  if (profile.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={40} radius={12} />
        <Skeleton height={120} radius={t.radiusLg} />
        <Skeleton height={220} radius={t.radiusLg} />
      </Screen>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      </Screen>
    );
  }

  const p = profile.data;
  const verificationMeta = VERIFICATION_STATUS_META[p.verificationStatus];

  return (
    <Screen scroll>
      <View style={styles.backBar}>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(partner)/(tabs)/more'))}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color={t.fg} />
          <Text style={[styles.backTitle, { color: t.fgStrong }]}>Business profile</Text>
        </Pressable>
      </View>

      <Card>
        <View style={styles.summaryHead}>
          <Text style={[styles.summaryName, { color: t.fgStrong }]} numberOfLines={2}>
            {p.businessName || 'Set up your business'}
          </Text>
          {verificationMeta ? (
            <Badge label={verificationMeta.label} tone={verificationMeta.tone} />
          ) : null}
        </View>
        <KeyValue
          items={[
            ...(p.responseRate != null
              ? [{ label: 'Response rate', value: `${formatNumber(p.responseRate, 0)}%` }]
              : []),
            ...(p.totalBookings != null ? [{ label: 'Bookings', value: p.totalBookings }] : []),
            ...(p.activeListings != null ? [{ label: 'Active listings', value: p.activeListings }] : []),
            ...(p.joinedAt ? [{ label: 'Member since', value: formatDate(p.joinedAt) }] : []),
            { label: 'Business type', value: humanize(p.businessType ?? 'SOLE_PROPRIETORSHIP') },
          ]}
        />
      </Card>

      <ProfileForm key={JSON.stringify(toForm(p))} initial={toForm(p)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backBar: { marginBottom: 2 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  backTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  summaryName: { flex: 1, fontSize: 17, fontWeight: '800' },
  logoRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 4 },
  logoWrap: { width: 76, height: 76 },
  logo: { width: 76, height: 76, borderRadius: 16 },
  logoAdd: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  logoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCopy: { flex: 1, gap: 4 },
  chipLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  error: { fontSize: 13, marginTop: -6, marginBottom: 8 },
  rowGap: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  actions: { gap: 10, marginTop: 8 },
});
