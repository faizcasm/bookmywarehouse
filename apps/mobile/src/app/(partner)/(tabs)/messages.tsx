/** Partner messages — conversation list (shared shape with customer inbox). */

import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SignInPrompt,
  Skeleton,
} from '@/components/ui';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { listConversations } from '@/services/api/account';
import { formatRelativeTime } from '@/utils/format';

export default function PartnerMessagesScreen() {
  const t = useTheme();
  const { user } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: ['partner-conversations'],
    queryFn: () => listConversations(),
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to read messages"
          subtitle="Customer conversations for your listings appear here."
          next="/(partner)/(tabs)/messages"
        />
      </Screen>
    );
  }

  if (query.isLoading) {
    return (
      <Screen padTop={false} style={styles.screen}>
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} radius={16} />
          ))}
        </View>
      </Screen>
    );
  }
  if (query.isError) {
    return (
      <Screen>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen padTop={false} style={styles.screen}>
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Card
            onPress={() => router.push(`/(partner)/conversation/${item.id}` as never)}
            style={styles.row}
          >
            <View style={styles.rowTop}>
              <Text style={[styles.name, { color: t.fgStrong }]} numberOfLines={1}>
                {item.counterpartyName}
              </Text>
              <Text style={{ color: t.faint, fontSize: 12 }}>
                {formatRelativeTime(item.lastMessageAt)}
              </Text>
            </View>
            {item.listingTitle ? (
              <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
                {item.listingTitle}
              </Text>
            ) : null}
            <View style={styles.rowBottom}>
              <Text style={[styles.preview, { color: t.muted }]} numberOfLines={1}>
                {item.lastMessage ?? 'No messages yet'}
              </Text>
              {item.unreadCount ? (
                <Badge label={String(item.unreadCount > 99 ? '99+' : item.unreadCount)} tone="accent" />
              ) : null}
            </View>
          </Card>
        )}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          try {
            await query.refetch();
          } finally {
            setRefreshing(false);
          }
        }}
        ListEmptyComponent={
          <EmptyState
            title="No conversations"
            subtitle="Messages from customers appear here once they reach out about a listing or booking."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12, flexGrow: 1 },
  row: { gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { flex: 1, fontSize: 13 },
});
