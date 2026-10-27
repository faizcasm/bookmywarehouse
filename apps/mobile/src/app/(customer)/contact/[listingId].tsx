/** Message the partner — subject + body composer that starts a conversation. */

import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner, Button, Screen, SignInPrompt, TextField } from '@/components/ui';
import { createConversation } from '@/services/api/account';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';

const SUBJECT_MIN = 3;
const SUBJECT_MAX = 160;
const BODY_MAX = 4000;
const DEFAULT_SUBJECT = 'Enquiry about this listing';

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function ContactPartnerScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { status: sessionStatus } = useSession();

  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState('');

  const send = useMutation({
    mutationFn: () =>
      createConversation({
        listingId: listingId!,
        subject: subject.trim(),
        body: body.trim(),
      }),
    onSuccess: (result) => router.replace(`/(customer)/conversation/${result.conversationId}`),
  });

  const subjectTrimmed = subject.trim();
  const bodyTrimmed = body.trim();
  const subjectValid = subjectTrimmed.length >= SUBJECT_MIN && subject.length <= SUBJECT_MAX;
  const bodyValid = bodyTrimmed.length >= 1 && body.length <= BODY_MAX;
  const canSend = subjectValid && bodyValid && !!listingId;

  if (sessionStatus !== 'authenticated') {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to message"
          subtitle="Conversations with partners are linked to your account."
          next={`/(customer)/contact/${listingId}`}
        />
      </Screen>
    );
  }

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
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <ChevronLeft size={24} color={t.fg} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.fgStrong }]} numberOfLines={1}>
          Message partner
        </Text>
        <View style={styles.back} />
      </View>

      <Screen scroll padTop={false}>
        <Text style={[styles.intro, { color: t.muted }]}>
          Ask about access, pricing, availability or anything else before you book. Your message is
          attached to this listing so the partner has the full context.
        </Text>

        <TextField
          label="Subject"
          value={subject}
          onChangeText={(text) => setSubject(text.slice(0, SUBJECT_MAX))}
          error={subjectValid ? undefined : `Subject must be ${SUBJECT_MIN}–${SUBJECT_MAX} characters.`}
          hint={`${subject.length}/${SUBJECT_MAX}`}
          maxLength={SUBJECT_MAX}
          placeholder="Subject"
          returnKeyType="next"
        />

        <TextField
          label="Message"
          value={body}
          onChangeText={(text) => setBody(text.slice(0, BODY_MAX))}
          placeholder="Hi! I'm interested in this space — is it available next month?"
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          error={bodyValid ? undefined : 'Write a message (at least 1 character).'}
          hint={`${body.length}/${BODY_MAX}`}
          maxLength={BODY_MAX}
        />

        {send.isError ? <Banner tone="danger" message={messageFor(send.error)} /> : null}

        <Button
          label={send.isPending ? 'Sending…' : 'Send message'}
          fullWidth
          disabled={!canSend}
          loading={send.isPending}
          onPress={() => send.mutate()}
        />
        <Button label="Cancel" variant="ghost" fullWidth onPress={() => router.back()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  intro: { fontSize: 14, lineHeight: 20 },
});
