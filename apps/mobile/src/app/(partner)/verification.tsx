/**
 * Partner verification (KYC) — status card plus the submission form for
 * DRAFT / REJECTED partners.
 *
 * `GET /partner/profile` already embeds the last submission (legal name, GST,
 * PAN, address, documents), so the form prefills from it even though the shared
 * `VerificationState` type only surfaces status fields — the extra keys are
 * read through a local widening cast and never invented.
 */

import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ArrowLeft, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
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
  getVerificationState,
  submitVerification,
  type VerificationInput,
} from '@/services/api/partner';
import { uriToDataUri, uploadFile } from '@/services/api/uploads';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { VERIFICATION_STATUS_META, formatDate, humanize } from '@/utils/format';
import type { VerificationState } from '@/types';

const BUSINESS_TYPES = [
  'SOLE_PROPRIETORSHIP',
  'PARTNERSHIP',
  'PRIVATE_LIMITED',
  'PUBLIC_LIMITED',
  'LLP',
  'HUF',
  'OTHER',
] as const;

const MAX_DOCS = 3;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_RE = /^[0-9A-Z]{15}$/;
const PIN_RE = /^[0-9]{6}$/;

interface DocumentEntry {
  label: string;
  url: string;
}

interface FormState {
  legalName: string;
  businessType: string;
  pan: string;
  gst: string;
  registration: string;
  addressLine: string;
  city: string;
  stateName: string;
  pincode: string;
  documents: DocumentEntry[];
}

/** The extra keys /partner/profile embeds beyond the typed VerificationState. */
interface VerificationPrefill extends VerificationState {
  legalBusinessName?: string | null;
  businessType?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  registrationNumber?: string | null;
  address?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  } | null;
}

function toForm(v: VerificationPrefill | null): FormState {
  return {
    legalName: v?.legalBusinessName ?? '',
    businessType: v?.businessType ?? 'SOLE_PROPRIETORSHIP',
    pan: v?.panNumber ?? '',
    gst: v?.gstNumber ?? '',
    registration: v?.registrationNumber ?? '',
    addressLine: v?.address?.addressLine1 ?? '',
    city: v?.address?.city ?? '',
    stateName: v?.address?.state ?? '',
    pincode: v?.address?.postalCode ?? '',
    documents: (v?.documents ?? []).map((doc) => ({ label: doc.label, url: doc.url })),
  };
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.legalName.trim().length < 2) errors.legalName = 'Legal business name is required.';
  if (form.pan.trim() !== '' && !PAN_RE.test(form.pan.trim().toUpperCase())) {
    errors.pan = 'PAN must look like ABCDE1234F';
  }
  if (form.gst.trim() !== '' && !GST_RE.test(form.gst.trim().toUpperCase())) {
    errors.gst = 'GSTIN must be 15 letters and digits.';
  }
  if (form.registration.trim().length > 60) {
    errors.registration = 'Keep the registration number under 60 characters.';
  }
  if (form.addressLine.trim().length < 3) errors.addressLine = 'Enter the registered address.';
  if (form.city.trim().length < 2) errors.city = 'Enter the city.';
  if (form.stateName.trim().length < 2) errors.stateName = 'Enter the state.';
  if (!PIN_RE.test(form.pincode.trim())) errors.pincode = 'Enter a 6-digit pincode.';
  if (form.documents.length === 0) {
    errors.documents = 'Attach at least one document (GST certificate, registration, or PAN card).';
  }
  return errors;
}

function VerificationForm({ initial }: { initial: FormState }) {
  const t = useTheme();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>(initial);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setField = (key: Exclude<keyof FormState, 'documents'>) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const pickDocument = async () => {
    if (uploading || form.documents.length >= MAX_DOCS) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setFormError('Allow photo access in Settings to attach a document.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7 });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      setUploading(true);
      setFormError(null);
      const uploaded = await uploadFile({ file: await uriToDataUri(asset.uri), folder: 'documents' });
      setForm((current) => ({
        ...current,
        documents: [
          ...current.documents,
          { label: `Business document ${current.documents.length + 1}`, url: uploaded.url },
        ].slice(0, MAX_DOCS),
      }));
      setErrors((current) => {
        const next = { ...current };
        delete next.documents;
        return next;
      });
      setNotice(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not upload the document.');
    } finally {
      setUploading(false);
    }
  };

  const submit = useMutation({
    mutationFn: () => {
      const payload: VerificationInput = {
        legalBusinessName: form.legalName.trim(),
        businessType: form.businessType,
        gstNumber: form.gst.trim().toUpperCase() || null,
        panNumber: form.pan.trim().toUpperCase() || null,
        registrationNumber: form.registration.trim() || null,
        address: {
          addressLine1: form.addressLine.trim(),
          city: form.city.trim(),
          state: form.stateName.trim(),
          postalCode: form.pincode.trim(),
          country: 'India',
        },
        documents: form.documents,
      };
      return submitVerification(payload);
    },
    onSuccess: () => {
      setFormError(null);
      setNotice('Documents submitted — our team reviews them within 2 business days.');
      qc.invalidateQueries({ queryKey: ['verification'] });
      qc.invalidateQueries({ queryKey: ['partner-profile'] });
      qc.invalidateQueries({ queryKey: ['partner-dashboard'] });
    },
    onError: (e) => {
      setNotice(null);
      if (e instanceof ApiError && e.issues.length) {
        setFormError(e.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
      } else {
        setFormError(e instanceof Error ? e.message : 'Could not submit. Try again.');
      }
    },
  });

  const onSubmit = () => {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    submit.mutate();
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

      <SectionHeader title="Business identity" />
      <TextField
        label="Legal business name"
        value={form.legalName}
        onChangeText={setField('legalName')}
        error={errors.legalName}
        placeholder="Exactly as printed on your registration"
        accessibilityLabel="Legal business name"
        maxLength={160}
      />
      <Text style={[styles.chipLabel, { color: t.fg }]}>Business type</Text>
      <View style={styles.chipRow}>
        {BUSINESS_TYPES.map((option) => {
          const active = form.businessType === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setField('businessType')(option)}
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
                  fontSize: 12.5,
                  fontWeight: '600',
                }}
              >
                {humanize(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label="PAN (optional)"
        value={form.pan}
        onChangeText={(value) => setField('pan')(value.toUpperCase())}
        error={errors.pan}
        autoCapitalize="characters"
        placeholder="ABCDE1234F"
        accessibilityLabel="PAN number"
        maxLength={10}
      />
      <TextField
        label="GSTIN (optional)"
        value={form.gst}
        onChangeText={(value) => setField('gst')(value.toUpperCase())}
        error={errors.gst}
        autoCapitalize="characters"
        placeholder="15-character GSTIN"
        accessibilityLabel="GSTIN"
        maxLength={15}
      />
      <TextField
        label="Registration number (optional)"
        value={form.registration}
        onChangeText={setField('registration')}
        error={errors.registration}
        placeholder="Company registration / CIN"
        accessibilityLabel="Registration number"
        maxLength={60}
      />

      <SectionHeader title="Registered address" />
      <TextField
        label="Address"
        value={form.addressLine}
        onChangeText={setField('addressLine')}
        error={errors.addressLine}
        multiline
        placeholder="Street, area, landmark"
        accessibilityLabel="Registered address"
        maxLength={200}
      />
      <View style={styles.rowGap}>
        <View style={styles.flex}>
          <TextField
            label="City"
            value={form.city}
            onChangeText={setField('city')}
            error={errors.city}
            placeholder="Mumbai"
            accessibilityLabel="City"
            maxLength={80}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="State"
            value={form.stateName}
            onChangeText={setField('stateName')}
            error={errors.stateName}
            placeholder="Maharashtra"
            accessibilityLabel="State"
            maxLength={80}
          />
        </View>
      </View>
      <TextField
        label="Pincode"
        value={form.pincode}
        onChangeText={setField('pincode')}
        error={errors.pincode}
        keyboardType="number-pad"
        placeholder="400001"
        accessibilityLabel="Pincode"
        maxLength={6}
      />

      <SectionHeader title={`Documents (${form.documents.length}/${MAX_DOCS})`} />
      {form.documents.length > 0 ? (
        <View style={styles.docGrid}>
          {form.documents.map((doc, index) => (
            <View key={`${doc.url}-${index}`} style={styles.docTile}>
              <Image
                source={{ uri: doc.url }}
                style={[styles.docImage, { backgroundColor: t.surface3 }]}
                contentFit="cover"
                transition={150}
                accessibilityLabel={doc.label}
              />
              <Pressable
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${doc.label}`}
                disabled={uploading || submit.isPending}
                onPress={() =>
                  setForm((current) => ({
                    ...current,
                    documents: current.documents.filter((_, i) => i !== index),
                  }))
                }
                style={[styles.docRemove, { backgroundColor: 'rgba(2,6,23,0.6)' }]}
              >
                <X size={14} color="#ffffff" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {errors.documents ? (
        <Text style={[styles.error, { color: t.danger }]}>{errors.documents}</Text>
      ) : null}
      {form.documents.length < MAX_DOCS ? (
        <Button
          label={uploading ? 'Uploading…' : form.documents.length > 0 ? 'Attach another' : 'Attach document'}
          variant="secondary"
          loading={uploading}
          disabled={uploading || submit.isPending}
          onPress={() => void pickDocument()}
        />
      ) : null}
      <Text style={{ color: t.faint, fontSize: 12.5, lineHeight: 17 }}>
        GST certificate, incorporation proof, or PAN card. Photos are uploaded securely and only
        visible to our review team.
      </Text>

      <View style={styles.actions}>
        <Button
          label={submit.isPending ? 'Submitting…' : 'Submit for review'}
          onPress={onSubmit}
          loading={submit.isPending}
          disabled={submit.isPending || uploading}
          fullWidth
        />
      </View>
    </KeyboardAvoidingView>
  );
}

export default function PartnerVerificationScreen() {
  const t = useTheme();
  const { user } = useSession();

  const state = useQuery({
    queryKey: ['verification'],
    queryFn: getVerificationState,
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to verify your business"
          subtitle="Verification unlocks publishing and payments for your listings."
          next="/(partner)/verification"
        />
      </Screen>
    );
  }

  if (state.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={40} radius={12} />
        <Skeleton height={120} radius={t.radiusLg} />
        <Skeleton height={240} radius={t.radiusLg} />
      </Screen>
    );
  }

  if (state.isError || !state.data) {
    return (
      <Screen>
        <ErrorState error={state.error} onRetry={() => state.refetch()} />
      </Screen>
    );
  }

  const v = state.data as VerificationPrefill;
  const meta = VERIFICATION_STATUS_META[v.status];
  const canSubmit = v.status === 'DRAFT' || v.status === 'REJECTED';

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
          <Text style={[styles.backTitle, { color: t.fgStrong }]}>Verification</Text>
        </Pressable>
      </View>

      <Card>
        <View style={styles.statusRow}>
          <Text style={{ color: t.fg, fontWeight: '600' }}>Current status</Text>
          <Badge label={meta?.label ?? v.status} tone={meta?.tone ?? 'neutral'} />
        </View>
        <KeyValue
          items={[
            ...(v.legalBusinessName
              ? [{ label: 'Legal name', value: v.legalBusinessName, block: true }]
              : []),
            ...(v.submittedAt ? [{ label: 'Submitted', value: formatDate(v.submittedAt) }] : []),
            ...(v.reviewedAt ? [{ label: 'Reviewed', value: formatDate(v.reviewedAt) }] : []),
            ...(v.documents?.length
              ? [{ label: 'Documents on file', value: `${v.documents.length}`, block: false }]
              : []),
          ]}
        />
        {v.status === 'REJECTED' && v.rejectionReason ? (
          <View style={[styles.rejection, { backgroundColor: t.dangerSoft }]}>
            <Text style={[styles.rejectionText, { color: t.dangerSoftFg }]}>
              {v.rejectionReason}
            </Text>
          </View>
        ) : null}
      </Card>

      {canSubmit ? (
        <>
          <SectionHeader
            title={v.status === 'REJECTED' ? 'Resubmit documents' : 'Submit documents'}
          />
          <VerificationForm
            key={JSON.stringify(toForm(v))}
            initial={toForm(v)}
          />
        </>
      ) : (
        <Card>
          <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>
            {v.status === 'VERIFIED'
              ? 'Your business is verified — you can publish listings and accept bookings.'
              : 'Your documents are under review. You’ll be notified as soon as a decision is made.'}
          </Text>
        </Card>
      )}
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
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rejection: { marginTop: 8, padding: 10, borderRadius: 10 },
  rejectionText: { fontSize: 13.5, lineHeight: 19 },
  chipLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  error: { fontSize: 13, marginBottom: 8 },
  docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  docTile: { width: 84, height: 84 },
  docImage: { width: 84, height: 84, borderRadius: 12 },
  docRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowGap: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  actions: { gap: 10, marginTop: 8 },
});
