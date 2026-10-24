/** Messages tab — conversation list. */

import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { listConversations } from '@/services/api/account';
import { formatRelativeTime } from '@/utils/format';

export default function MessagesScreen() {
  const t = useTheme();
  const { status } = useSession();

  const query = useQuery({
    queryKey: ['conversations'],
    queryFn: () => listConversations(),
    enabled: status === 'authenticated',
  });

  if (status !== 'authenticated') {
    return (
      <Screen>
        <EmptyState
          title="Sign in to view messages"
          subtitle="Your conversations with partners and customers appear here."
          actionLabel="Sign in"
          onAction={() => router.push('/(auth)/login')}
        />
      </Screen>
    );
  }

  return (
    <Screen padTop={false} style={styles.screen}>
      {query.isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} radius={16} />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data && query.data.items.length ? (
        <FlatList
          data={query.data.items}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/(customer)/conversation/${item.id}`)} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={[styles.name, { color: t.fgStrong }]} numberOfLines={1}>
                  {item.counterpartyName}
                </Text>
                <Text style={{ color: t.faint, fontSize: 12 }}>{formatRelativeTime(item.lastMessageAt)}</Text>
              </View>
              {item.listingTitle ? (
                <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
                  {item.listingTitle}
                </Text>
              ) : null}
              <Text style={{ color: t.muted }} numberOfLines={1}>
                {item.lastMessage ?? 'No messages yet'}
              </Text>
              {item.unreadCount ? (
                <View style={[styles.unread, { backgroundColor: t.brand }]}>
                  <Text style={{ color: t.brandFg, fontSize: 12, fontWeight: '700' }}>{item.unreadCount}</Text>
                </View>
              ) : null}
            </Card>
          )}
          contentContainerStyle={styles.list}
        />
      ) : (
        <EmptyState title="No conversations" subtitle="Messages from your bookings will appear here." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  row: { gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  unread: { position: 'absolute', top: 12, right: 12, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});