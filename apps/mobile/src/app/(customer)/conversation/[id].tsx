/** Conversation thread — messages + send box. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ErrorState, LoadingOverlay } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { getMessages, sendMessage } from '@/services/api/account';
import { formatRelativeTime } from '@/utils/format';
import { MESSAGE_POLL_MS } from '@/constants/config';

export default function ConversationScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [body, setBody] = useState('');
  const listRef = useRef<FlatList>(null);

  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => getMessages(id!),
    enabled: !!id,
    refetchInterval: MESSAGE_POLL_MS,
  });

  useEffect(() => {
    const unsub = qc.getQueryCache().subscribe(() => {
      // keep the list pinned to the bottom as new messages arrive
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    return unsub;
  }, [qc]);

  const send = useMutation({
    mutationFn: () => sendMessage(id!, body.trim()),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['messages', id] });
    },
  });

  if (messages.isLoading) return <LoadingOverlay />;
  if (messages.isError) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <FlatList
        ref={listRef}
        data={messages.data ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs, { backgroundColor: mine ? t.brand : t.surface3 }]}>
              <Text style={{ color: mine ? t.brandFg : t.fg }}>{item.body}</Text>
              <Text style={{ color: mine ? t.brandFg : t.faint, fontSize: 11, marginTop: 2 }}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
          );
        }}
      />

      <View style={[styles.composer, { backgroundColor: t.surface, borderTopColor: t.line, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Type a message…"
          placeholderTextColor={t.faint}
          style={[styles.input, { backgroundColor: t.surface2, color: t.fg }]}
          multiline
        />
        <Button label="Send" onPress={() => send.mutate()} loading={send.isPending} disabled={!body.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 8 },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, maxHeight: 120 },
});