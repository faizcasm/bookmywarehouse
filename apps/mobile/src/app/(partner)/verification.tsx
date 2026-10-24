/** Partner verification — status, submit documents, rejection feedback. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, ErrorState, Screen, Skeleton, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { getVerificationState, submitVerification } from '@/services/api/partner';
import { VERIFICATION_STATUS_META, formatDate } from '@/utils/format';

export default function VerificationScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [docUrl, setDocUrl] = useState('');
  const [docType, setDocType] = useState('GST_CERTIFICATE');

  const state = useQuery({ queryKey: ['verification'], queryFn: getVerificationState });

  const submit = useMutation({
    mutationFn: () =>
      submitVerification({ documents: [{ url: docUrl.trim(), type: docType.trim() || 'GST_CERTIFICATE' }] }),
    onSuccess: () => {
      Alert.alert('Submitted', 'Your documents are under review.');
      setDocUrl('');
      qc.invalidateQueries({ queryKey: ['verification'] });
    },
    onError: (e) => Alert.alert('Could not submit', e instanceof Error ? e.message : 'Try again.'),
  });

  if (state.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={120} radius={16} />
      </Screen>
    );
  }
  if (state.isError) {
    return (
      <Screen>
        <ErrorState error={state.error} onRetry={() => state.refetch()} />
      </Screen>
    );
  }

  const v = state.data;
  const meta = VERIFICATION_STATUS_META[v?.status ?? 'DRAFT'];
  const canSubmit = !v || v.status === 'DRAFT' || v.status === 'REJECTED';

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
                {humanizeType(d.type)}
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
          <Text style={{ color: t.muted, fontSize: 13 }}>
            Paste a link to your business document (GST certificate, registration or address proof). The verification
            team reviews submissions within a few working days.
          </Text>
          <TextField
            label="Document type"
            value={docType}
            onChangeText={setDocType}
            placeholder="GST_CERTIFICATE"
            autoCapitalize="characters"
          />
          <TextField
            label="Document URL"
            value={docUrl}
            onChangeText={setDocUrl}
            placeholder="https://…"
            autoCapitalize="none"
            error={docUrl && !/^https?:\/\//.test(docUrl) ? 'Enter a valid URL' : undefined}
          />
          <Button
            label="Submit for review"
            onPress={() => submit.mutate()}
            loading={submit.isPending}
            disabled={!docUrl.trim()}
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
});
