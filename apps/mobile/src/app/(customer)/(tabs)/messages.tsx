/** Messages tab — conversation list with unread indicators. */

import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Avatar, Badge, Card, Screen, SignInPrompt } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { listConversations } from '@/services/api/account';
import { formatRelativeTime } from '@/utils/format';
import type { Conversation } from '@/types';

export default function MessagesScreen() {
  const { user } = useSession();

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to view messages"
          subtitle="Your conversations with partners and customers appear here."
          next="/(customer)/(tabs)/messages"
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <PaginatedList<Conversation>
        queryKey={['conversations']}
        fetchPage={(page) => listConversations({ page })}
        keyExtractor={(c) => c.id}
        itemHeight={92}
        emptyTitle="No conversations"
        emptySubtitle="Messages from your bookings will appear here."
        renderItem={(conversation) => <ConversationRow conversation={conversation} />}
      />
    </Screen>
  );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const t = useTheme();
  const unread = (conversation.unreadCount ?? 0) > 0;

  return (
    <Card
      onPress={() => router.push(`/(customer)/conversation/${conversation.id}`)}
      style={{ ...styles.row, ...(unread ? { borderColor: t.brand } : null) }}
    >
      <Avatar
        uri={conversation.counterpartyAvatar}
        name={conversation.counterpartyName}
        size={44}
      />
      <View style={styles.info}>
        <View style={styles.topLine}>
          <Text
            style={[styles.name, { color: unread ? t.fgStrong : t.fg }]}
            numberOfLines={1}
          >
            {conversation.counterpartyName}
          </Text>
          <Text style={[styles.time, { color: t.faint }]}>
            {formatRelativeTime(conversation.lastMessageAt)}
          </Text>
        </View>
        {conversation.listingTitle ? (
          <Text style={[styles.context, { color: t.muted }]} numberOfLines={1}>
            {conversation.listingTitle}
          </Text>
        ) : null}
        <View style={styles.bottomLine}>
          <Text
            style={[styles.preview, { color: unread ? t.fgStrong : t.muted }]}
            numberOfLines={1}
          >
            {conversation.lastMessage ?? 'No messages yet'}
          </Text>
          {conversation.unreadCount ? (
            <Badge
              label={conversation.unreadCount > 99 ? '99+' : String(conversation.unreadCount)}
              tone="accent"
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, gap: 2 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  time: { fontSize: 12 },
  context: { fontSize: 12.5 },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  preview: { fontSize: 13.5, flexShrink: 1 },
});
