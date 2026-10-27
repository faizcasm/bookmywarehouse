/** Notifications — list + mark read / mark all read. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Button, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import {
  listNotifications,
  markNotificationsRead,
} from '@/services/api/account';
import { formatRelativeTime, humanize } from '@/utils/format';
import type { Notification } from '@/types';

export default function NotificationsScreen() {
  const t = useTheme();
  const qc = useQueryClient();

  const markAll = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const res = await listNotifications({ page: 1 });
      return res.items.filter((n) => !n.read).length;
    },
  });

  return (
    <Screen padTop={false} style={styles.screen}>
      <View style={styles.header}>
        {unread.data ? <Text style={{ color: t.muted }}>{unread.data} unread</Text> : <View />}
        <Button
          label="Mark all read"
          variant="ghost"
          onPress={() => markAll.mutate()}
          loading={markAll.isPending}
          disabled={!unread.data}
        />
      </View>
      <PaginatedList<Notification>
        queryKey={['notifications']}
        fetchPage={(page) => listNotifications({ page })}
        keyExtractor={(n) => n.id}
        emptyTitle="No notifications"
        emptySubtitle="Booking updates and messages will appear here."
        itemHeight={76}
        renderItem={(n) => (
          <Card style={!n.read ? { borderColor: t.brand } : undefined}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: n.read ? t.muted : t.fgStrong }]} numberOfLines={1}>
                  {n.title}
                </Text>
                {n.body ? (
                  <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={2}>
                    {n.body}
                  </Text>
                ) : null}
                <Text style={{ color: t.faint, fontSize: 12, marginTop: 2 }}>
                  {humanize(n.type)} · {formatRelativeTime(n.createdAt)}
                </Text>
              </View>
              {n.read ? null : <Badge label="New" tone="accent" />}
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { fontSize: 15, fontWeight: '700' },
});
