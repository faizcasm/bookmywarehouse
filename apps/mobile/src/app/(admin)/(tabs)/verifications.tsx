/** Admin verifications — review queue with approve/reject (partner decisions). */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Button, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listVerifications, decidePartner, type AdminPartnerRow } from '@/services/api/admin';
import { VERIFICATION_STATUS_META, humanize, formatDate } from '@/utils/format';

const ACTIONABLE = new Set(['SUBMITTED', 'UNDER_REVIEW']);

export default function AdminVerificationsScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-verifications'] });
    qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const approve = useMutation({
    mutationFn: (partnerId: string) => decidePartner(partnerId, 'APPROVE'),
    onSuccess: () => {
      Alert.alert('Approved', 'The partner is now verified.');
      invalidate();
    },
    onError: (e) => Alert.alert('Could not approve', e instanceof Error ? e.message : 'Try again.'),
  });

  const reject = useMutation({
    mutationFn: ({ partnerId, reason }: { partnerId: string; reason: string }) =>
      decidePartner(partnerId, 'REJECT', reason),
    onSuccess: invalidate,
  });

  const confirmReject = (partnerId: string) => {
    // Alert.prompt is iOS-only; use it where available, otherwise fall back to
    // a confirmation with a standard reason so the flow works on Android too.
    if (typeof Alert.prompt === 'function') {
      Alert.prompt(
        'Reject verification',
        'Reason for rejection',
        (text) => {
          const reason = (text ?? '').trim();
          if (reason) reject.mutate({ partnerId, reason });
        },
        'plain-text',
      );
    } else {
      Alert.alert('Reject verification', 'Rejection will be recorded with a standard reason.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => reject.mutate({ partnerId, reason: 'Documents rejected' }) },
      ]);
    }
  };

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Verifications</Text>
      <PaginatedList<AdminPartnerRow>
        queryKey={['admin-verifications']}
        fetchPage={(page) => listVerifications({ page, limit: 20 })}
        keyExtractor={(v) => v.partnerId}
        emptyTitle="No verifications"
        emptySubtitle="Partner verification submissions will appear here."
        itemHeight={140}
        renderItem={(v) => {
          const meta = VERIFICATION_STATUS_META[v.verificationStatus as keyof typeof VERIFICATION_STATUS_META];
          const name = v.businessName || v.user?.name || 'Partner';
          const actionable = ACTIONABLE.has(v.verificationStatus);
          return (
            <Card style={{ gap: 8 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: t.fgStrong }]}>{name}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>
                    {humanize(v.verificationStatus)} · {formatDate(v.createdAt)}
                  </Text>
                </View>
                <Badge label={meta?.label ?? v.verificationStatus} tone={meta?.tone ?? 'neutral'} />
              </View>
              {actionable ? (
                <View style={styles.actions}>
                  <Button label="Approve" onPress={() => approve.mutate(v.partnerId)} loading={approve.isPending} />
                  <Button label="Reject" variant="danger" onPress={() => confirmReject(v.partnerId)} />
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  heading: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
});
