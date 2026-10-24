/** Admin verifications — review queue with approve/reject. */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Button, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listVerifications, approveVerification, rejectVerification } from '@/services/api/admin';
import { VERIFICATION_STATUS_META, formatDate } from '@/utils/format';

interface VerificationRow {
  id: string;
  partnerId: string;
  partnerName: string;
  status: string;
  submittedAt: string;
}

export default function AdminVerificationsScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-verifications'] });
    qc.invalidateQueries({ queryKey: ['admin-pending-verifications'] });
    qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const approve = useMutation({
    mutationFn: approveVerification,
    onSuccess: () => {
      Alert.alert('Approved', 'The partner is now verified.');
      invalidate();
    },
    onError: (e) => Alert.alert('Could not approve', e instanceof Error ? e.message : 'Try again.'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectVerification(id, reason),
    onSuccess: invalidate,
  });

  const confirmReject = (id: string) => {
    // Alert.prompt is iOS-only; use it where available, otherwise fall back to
    // a confirmation with a standard reason so the flow works on Android too.
    if (typeof Alert.prompt === 'function') {
      Alert.prompt(
        'Reject verification',
        'Reason for rejection',
        (text) => {
          const reason = (text ?? '').trim();
          if (reason) reject.mutate({ id, reason });
        },
        'plain-text',
      );
    } else {
      Alert.alert('Reject verification', 'Rejection will be recorded with a standard reason.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => reject.mutate({ id, reason: 'Documents rejected' }) },
      ]);
    }
  };

  return (
    <Screen padTop={false} style={styles.screen}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Verifications</Text>
      <PaginatedList<VerificationRow>
        queryKey={['admin-verifications']}
        fetchPage={(page) => listVerifications<VerificationRow>({ page, limit: 20 })}
        keyExtractor={(v) => v.id}
        emptyTitle="No verifications"
        emptySubtitle="Partner verification submissions will appear here."
        itemHeight={140}
        renderItem={(v) => {
          const meta = VERIFICATION_STATUS_META[v.status as keyof typeof VERIFICATION_STATUS_META];
          return (
            <Card style={{ gap: 8 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: t.fgStrong }]}>{v.partnerName}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>Submitted {formatDate(v.submittedAt)}</Text>
                </View>
                <Badge label={meta?.label ?? v.status} tone={meta?.tone ?? 'neutral'} />
              </View>
              {v.status === 'PENDING' ? (
                <View style={styles.actions}>
                  <Button label="Approve" onPress={() => approve.mutate(v.id)} loading={approve.isPending} />
                  <Button label="Reject" variant="danger" onPress={() => confirmReject(v.id)} />
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
