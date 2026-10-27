/** Partner verification — status, KYC submission with document upload, feedback. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, ErrorState, Screen, Skeleton, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getVerificationState, submitVerification } from '@/services/api/partner';
import { uriToDataUri, uploadFile } from '@/services/api/uploads';
import { VERIFICATION_STATUS_META, formatDate } from '@/utils/format';

const BUSINESS_TYPES = ['SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'PRIVATE_LIMITED', 'LLP', 'OTHER'] as const;

export default function VerificationScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const [legalName, setLegalName] = useState('');
  const [businessType, setBusinessType] = useState<string>('SOLE_PROPRIETORSHIP');
  const [pan, setPan] = useState('');
  const [gst, setGst] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [doc, setDoc] = useState<{ url: string; uri: string } | null>(null);

  const state0 = useQuery({ queryKey: ['verification'], queryFn: getVerificationState });

  const pickDoc = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach a document.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    try {
      const dataUri = await uriToDataUri(asset.uri);
      const uploaded = await uploadFile({ file: dataUri, folder: 'documents' });
      setDoc({ url: uploaded.url, uri: asset.uri });
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload the document.');
    }
  };

  const submit = useMutation({
    mutationFn: () =>
      submitVerification({
        legalBusinessName: legalName.trim(),
        businessType,
        panNumber: pan.trim().toUpperCase() || null,
        gstNumber: gst.trim().toUpperCase() || null,
        address: {
          addressLine1: addressLine.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: pincode.trim(),
          country: 'India',
        },
        documents: doc ? [{ label: 'Business document', url: doc.url }] : [],
      }),
    onSuccess: () => {
      Alert.alert('Submitted', 'Your documents are under review.');
      setDoc(null);
      qc.invalidateQueries({ queryKey: ['verification'] });
    },
    onError: (e) => Alert.alert('Could not submit', e instanceof Error ? e.message : 'Try again.'),
  });

  if (state0.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={120} radius={16} />
      </Screen>
    );
  }
  if (state0.isError) {
    return (
      <Screen>
        <ErrorState error={state0.error} onRetry={() => state0.refetch()} />
      </Screen>
    );
  }

  const v = state0.data;
  const meta = VERIFICATION_STATUS_META[v?.status ?? 'DRAFT'];
  const canSubmit = !v || v.status === 'DRAFT' || v.status === 'REJECTED';

  const valid =
    legalName.trim().length >= 2 &&
    addressLine.trim().length >= 2 &&
    city.trim().length >= 1 &&
    state.trim().length >= 1 &&
    /^[0-9]{6}$/.test(pincode.trim()) &&
    (pan.trim() === '' || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase())) &&
    !!doc;

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Verification</Text>

      <Card>
        <View style={styles.row}>
          <Text style={{ color: t.fg, fontWeight: '600' }}>Current status</Text>
          <Badge label={meta?.label ?? v?.status} tone={meta?.tone ?? 'neutral'} />
        </View>
        {v?.submittedAt ? (
          <Text style={{ color: t.muted, fontSize: 13, marginTop: 6 }}>Submitted {formatDate(v.submittedAt)}</Text>
        ) : null}
        {v?.status === 'REJECTED' && v.rejectionReason ? (
          <View style={[styles.rejection, { backgroundColor: t.dangerSoft }]}>
            <Text style={{ color: t.dangerSoftFg }}>Reason: {v.rejectionReason}</Text>
          </View>
        ) : null}
        {v?.documents?.length ? (
          <View style={{ marginTop: 8, gap: 4 }}>
            <Text style={{ color: t.fgStrong, fontWeight: '600', fontSize: 13 }}>Documents on file</Text>
            {v.documents.map((d, i) => (
              <Text key={i} style={{ color: t.muted, fontSize: 13 }}>
                {d.label ?? 'Document'}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      {canSubmit ? (
        <Card style={{ gap: 12 }}>
          <Text style={{ color: t.fgStrong, fontWeight: '700' }}>
            {v?.status === 'REJECTED' ? 'Resubmit documents' : 'Submit documents'}
          </Text>

          <TextField label="Legal business name" value={legalName} onChangeText={setLegalName} />

          <View>
            <Text style={{ color: t.fg, fontWeight: '600', marginBottom: 6 }}>Business type</Text>
            <View style={styles.chipRow}>
              {BUSINESS_TYPES.map((bt) => {
                const active = businessType === bt;
                return (
                  <Text
                    key={bt}
                    onPress={() => setBusinessType(bt)}
                    style={[styles.chip, { backgroundColor: active ? t.brand : t.surface, borderColor: active ? t.brand : t.line, color: active ? t.brandFg : t.fg }]}
                  >
                    {humanizeType(bt)}
                  </Text>
                );
              })}
            </View>
          </View>

          <TextField
            label="PAN (optional)"
            value={pan}
            onChangeText={setPan}
            autoCapitalize="characters"
            placeholder="ABCDE1234F"
            error={pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase()) ? 'PAN must look like ABCDE1234F' : undefined}
          />
          <TextField
            label="GST (optional)"
            value={gst}
            onChangeText={setGst}
            autoCapitalize="characters"
            placeholder="15-character GSTIN"
          />

          <TextField label="Address" value={addressLine} onChangeText={setAddressLine} multiline />
          <View style={styles.rowGap}>
            <View style={{ flex: 1 }}>
              <TextField label="City" value={city} onChangeText={setCity} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="State" value={state} onChangeText={setState} />
            </View>
          </View>
          <TextField
            label="Pincode"
            value={pincode}
            onChangeText={setPincode}
            keyboardType="numeric"
            maxLength={6}
            error={pincode && !/^[0-9]{6}$/.test(pincode) ? 'Enter a 6-digit pincode' : undefined}
          />

          <View style={{ gap: 8 }}>
            <Text style={{ color: t.fgStrong, fontWeight: '600', fontSize: 13 }}>Document</Text>
            {doc ? <Image source={{ uri: doc.uri }} style={styles.preview} /> : null}
            <Button label={doc ? 'Change document' : 'Attach document'} variant="secondary" onPress={pickDoc} />
          </View>

          <Button
            label="Submit for review"
            onPress={() => submit.mutate()}
            loading={submit.isPending}
            disabled={!valid}
            fullWidth
          />
        </Card>
      ) : (
        <Card>
          <Text style={{ color: t.muted }}>
            {v?.status === 'VERIFIED'
              ? 'Your business is verified. You can publish listings and accept bookings.'
              : 'Your documents are under review. You will be notified once a decision is made.'}
          </Text>
        </Card>
      )}
    </Screen>
  );
}

function humanizeType(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rejection: { marginTop: 8, padding: 10, borderRadius: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, overflow: 'hidden', fontSize: 12, fontWeight: '600' },
  rowGap: { flexDirection: 'row', gap: 12 },
  preview: { width: '100%', height: 160, borderRadius: 12 },
});
