/** Conversation thread — header, messages, auto-refresh and send box. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  LoadingOverlay,
  Screen,
  SignInPrompt,
} from '@/components/ui';
import { getConversation, getMessages, markConversationRead, sendMessage } from '@/services/api/account';
import { MESSAGE_POLL_MS } from '@/constants/config';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import type { Message } from '@/types';
import { formatRelativeTime } from '@/utils/format';

const POLL_SECONDS = Math.round(MESSAGE_POLL_MS / 1000);

export default function ConversationScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, status } = useSession();
  const signedIn = status === 'authenticated';
  const [body, setBody] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const conversation = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => getConversation(id!),
    enabled: !!id && signedIn,
  });

  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => getMessages(id!),
    enabled: !!id && signedIn,
    refetchInterval: MESSAGE_POLL_MS,
  });

  // Clear the unread badge once the thread is opened.
  useEffect(() => {
    if (!id || !signedIn) return;
    markConversationRead(id)
      .then(() => qc.invalidateQueries({ queryKey: ['conversations'] }))
      .catch(() => {
        /* best-effort — the badge clears on the next open */
      });
  }, [id, qc, signedIn]);

  // Pin to the bottom whenever the message list grows.
  useEffect(() => {
    if (messages.data) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    }
  }, [messages.data]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await messages.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const send = useMutation({
    mutationFn: () => sendMessage(id!, body.trim()),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['messages', id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  if (!signedIn) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to view messages"
          subtitle="Your conversations with partners live on your account."
          next={`/(customer)/conversation/${id}`}
        />
      </Screen>
    );
  }
  if (messages.isLoading) return <LoadingOverlay />;
  if (messages.isError) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
      </View>
    );
  }

  const thread = conversation.data;
  const list = messages.data ?? [];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 6, backgroundColor: t.surface, borderBottomColor: t.line },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.headerSide, pressed && { opacity: 0.6 }]}
        >
          <ChevronLeft size={24} color={t.fg} />
        </Pressable>
        <Avatar uri={thread?.counterpartyAvatar} name={thread?.counterpartyName} size={36} />
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: t.fgStrong }]} numberOfLines={1}>
            {thread?.counterpartyName ?? 'Conversation'}
          </Text>
          {thread?.listingTitle ? (
            <Text style={[styles.headerSub, { color: t.muted }]} numberOfLines={1}>
              {thread.listingTitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerSide} />
      </View>

      {list.length ? (
        <FlatList
          ref={listRef}
          data={list}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            return (
              <View
                style={[
                  styles.bubble,
                  mine ? styles.mine : styles.theirs,
                  { backgroundColor: mine ? t.brand : t.surface3 },
                ]}
              >
                <Text style={{ color: mine ? t.brandFg : t.fg }}>{item.body}</Text>
                <Text
                  style={[
                    styles.time,
                    { color: mine ? t.brandFg : t.faint },
                  ]}
                >
                  {formatRelativeTime(item.createdAt)}
                </Text>
              </View>
            );
          }}
        />
      ) : (
        <EmptyState
          title="No messages yet"
          subtitle="Ask about availability, access or pricing — the partner usually replies within a few hours."
        />
      )}

      <View
        style={[
          styles.composer,
          {
            backgroundColor: t.surface,
            borderTopColor: t.line,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        <Text style={[styles.pollNote, { color: t.faint }]}>
          Messages refresh automatically every {POLL_SECONDS} seconds.
        </Text>
        <View style={styles.composerRow}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Type a message…"
            placeholderTextColor={t.faint}
            style={[styles.input, { backgroundColor: t.surface2, color: t.fg }]}
            multiline
            accessibilityLabel="Message"
          />
          <Button
            label="Send"
            onPress={() => send.mutate()}
            loading={send.isPending}
            disabled={!body.trim()}
          />
        </View>
        {send.isError ? (
          <Text style={{ color: t.danger, fontSize: 12.5 }}>
            {send.error instanceof Error ? send.error.message : 'Could not send — tap Send to retry.'}
          </Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerSide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 12 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  time: { fontSize: 11, marginTop: 2 },
  composer: { gap: 6, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1 },
  pollNote: { fontSize: 11, textAlign: 'center' },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
});
