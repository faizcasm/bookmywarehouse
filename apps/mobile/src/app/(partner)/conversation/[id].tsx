/**
 * Partner conversation — one message thread with a customer.
 *
 * Opens from the Messages tab, marks the thread read on mount, and sends via
 * POST /conversations/:id/messages. The thread is role-agnostic on the API
 * side, so the same endpoints the customer inbox uses apply here.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Banner,
  EmptyState,
  ErrorState,
  Screen,
  SignInPrompt,
  Skeleton,
} from '@/components/ui';
import {
  getConversation,
  getMessages,
  markConversationRead,
  sendMessage,
} from '@/services/api/account';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { formatDateTime } from '@/utils/format';
import type { Message } from '@/types';

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Try again.';

function Bubble({ message, own }: { message: Message; own: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.bubble,
        own
          ? [styles.own, { backgroundColor: t.brand }]
          : [styles.theirs, { backgroundColor: t.surface, borderColor: t.line }],
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${own ? 'You' : 'Customer'} said: ${message.body}`}
    >
      <Text style={{ color: own ? t.brandFg : t.fg, fontSize: 14.5, lineHeight: 20 }}>
        {message.body}
      </Text>
      <Text style={{ color: own ? t.brandFg : t.faint, fontSize: 11, opacity: own ? 0.8 : 1 }}>
        {formatDateTime(message.createdAt)}
      </Text>
    </View>
  );
}

export default function PartnerConversationScreen() {
  const t = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = id ?? '';

  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);

  const conversation = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId),
    enabled: Boolean(conversationId) && Boolean(user),
  });

  const messages = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: () => getMessages(conversationId),
    enabled: Boolean(conversationId) && Boolean(user),
  });

  const markRead = useMutation({
    mutationFn: () => markConversationRead(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-conversations'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Mark the thread read once when it opens (a mutation, not state, in the effect).
  useEffect(() => {
    if (conversationId && user) markRead.mutate();
  }, [conversationId, user, markRead]);

  const send = useMutation({
    mutationFn: (body: string) => sendMessage(conversationId, body),
    onSuccess: () => {
      setDraft('');
      setSendError(null);
      qc.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['partner-conversations'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e) => setSendError(errorText(e)),
  });

  const onSend = () => {
    const body = draft.trim();
    if (body.length === 0 || send.isPending) return;
    send.mutate(body);
  };

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to read messages"
          subtitle="Customer conversations are part of your partner account."
          next={`/(partner)/conversation/${conversationId}`}
        />
      </Screen>
    );
  }

  if (messages.isLoading || conversation.isLoading) {
    return (
      <Screen>
        <Skeleton height={36} radius={12} />
        <Skeleton height={64} radius={16} style={styles.mt12} />
        <Skeleton height={48} radius={16} style={styles.mt8} />
        <Skeleton height={64} radius={16} style={styles.mt8} />
      </Screen>
    );
  }

  if (messages.isError) {
    return (
      <Screen>
        <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
      </Screen>
    );
  }

  const items = [...(messages.data ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  return (
    <Screen style={styles.screen} padTop={false}>
      <View style={[styles.header, { borderBottomColor: t.line }]}>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to messages"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(partner)/(tabs)/messages'))}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color={t.fg} />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: t.fgStrong }]} numberOfLines={1}>
              {conversation.data?.counterpartyName ?? 'Conversation'}
            </Text>
            {conversation.data?.listingTitle ? (
              <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
                {conversation.data.listingTitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>

      {sendError ? <Banner tone="danger" message={sendError} actionLabel="Dismiss" onAction={() => setSendError(null)} /> : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <FlatList
          data={items}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => (
            <Bubble message={item} own={item.senderId === user.id} />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="No messages yet"
              subtitle="Say hello — customers reply from their booking page."
            />
          }
          keyboardShouldPersistTaps="handled"
        />

        <View style={[styles.composer, { borderTopColor: t.line, backgroundColor: t.surface }]}>
          <TextInput
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              setSendError(null);
            }}
            placeholder="Write a message…"
            placeholderTextColor={t.faint}
            style={[styles.input, { color: t.fg, backgroundColor: t.surface2, borderColor: t.line }]}
            multiline
            accessibilityLabel="Message text"
            maxLength={2000}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: draft.trim().length === 0 || send.isPending, busy: send.isPending }}
            disabled={draft.trim().length === 0 || send.isPending}
            onPress={onSend}
            hitSlop={6}
            style={[
              styles.send,
              {
                backgroundColor:
                  draft.trim().length === 0 || send.isPending ? t.surface3 : t.brand,
              },
            ]}
          >
            <Send size={18} color={draft.trim().length === 0 ? t.faint : t.brandFg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  flex: { flex: 1 },
  mt12: { marginTop: 12 },
  mt8: { marginTop: 8 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 3,
  },
  own: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 110,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
