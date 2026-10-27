/** Admin users — search + suspend/activate. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge, Card, EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { listAdminUsers, moderateUser, type UserModerationAction } from '@/services/api/admin';
import { humanize, formatDate } from '@/utils/format';
import type { User } from '@/types';

export default function AdminUsersScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const [q, setQ] = useState('');

  const users = useQuery({ queryKey: ['admin-users', q], queryFn: () => listAdminUsers({ q, limit: 50 }) });

  const setStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: UserModerationAction }) => moderateUser(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (e) => Alert.alert('Action failed', e instanceof Error ? e.message : 'Try again.'),
  });

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Users</Text>
      <View style={[styles.searchWrap, { backgroundColor: t.surface, borderColor: t.line }]}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search by name or email"
          placeholderTextColor={t.faint}
          style={{ color: t.fg, fontSize: 16, paddingVertical: 10 }}
          autoCapitalize="none"
        />
      </View>

      {users.isLoading ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={90} radius={16} />)
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : (users.data?.items?.length ?? 0) === 0 ? (
        <EmptyState title="No users found" subtitle="Try a different search." />
      ) : (
        (users.data?.items ?? []).map((row: User) => {
          const suspended = row.status === 'SUSPENDED';
          return (
            <Card key={row.id} style={{ gap: 6 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: t.fgStrong }]}>{row.name}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>{row.email}</Text>
                  <Text style={{ color: t.faint, fontSize: 12 }}>
                    {humanize(row.role)} · joined {formatDate(row.createdAt)}
                  </Text>
                </View>
                <Badge label={row.status ?? 'ACTIVE'} tone={suspended ? 'danger' : 'success'} />
              </View>
              {suspended ? (
                <Text
                  onPress={() => setStatus.mutate({ id: row.id, action: 'REACTIVATE' })}
                  style={{ color: t.brand, fontWeight: '600' }}
                >
                  Reactivate →
                </Text>
              ) : (
                <Text
                  onPress={() =>
                    Alert.alert('Suspend user', 'They will no longer be able to sign in.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Suspend', style: 'destructive', onPress: () => setStatus.mutate({ id: row.id, action: 'SUSPEND' }) },
                    ])
                  }
                  style={{ color: t.danger, fontWeight: '600' }}
                >
                  Suspend →
                </Text>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800' },
  searchWrap: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '700' },
});
