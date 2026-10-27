/**
 * Verify email — confirms the token from the emailed verification link.
 *
 * Deep links land here as `/(auth)/verify-email?token=…`. The token is verified
 * automatically; when it's missing (some mail apps strip query params) or was
 * rejected, the user can paste the code from the email and retry.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MailCheck } from 'lucide-react-native';

import { Banner, Button, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { verifyEmail } from '@/services/api/auth';

export default function VerifyEmailScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token.trim() : '';

  const [manualToken, setManualToken] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Auto-verify the emailed token once. `retry: false` — an invalid or expired
  // token should surface the error state, not hammer the endpoint.
  const auto = useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => verifyEmail(token),
    enabled: token.length > 0,
    retry: false,
  });

  const manual = useMutation({
    mutationFn: (value: string) => verifyEmail(value.trim()),
    onMutate: () => setManualError(null),
    onError: (err) =>
      setManualError(err instanceof Error ? err.message : 'That verification code was not accepted.'),
  });

  const success = manual.isSuccess || (token.length > 0 && auto.isSuccess);
  const verifying = (token.length > 0 && auto.isFetching) || manual.isPending;
  const autoRejected = token.length > 0 && auto.isError;
  const errorMessage =
    autoRejected && auto.error instanceof Error
      ? auto.error.message
      : 'That verification link is no longer valid. Paste the code from your email to try again.';
  const showPasteField = !token || autoRejected;

  return (
    <Screen
      scroll
      style={{ ...styles.content, paddingTop: insets.top + 48 }}
    >
      <View style={[styles.iconWrap, { backgroundColor: t.brandSoft }]}>
        <MailCheck size={28} color={t.brandSoftFg} />
      </View>

      <Text style={[styles.title, { color: t.fgStrong }]}>
        {success ? 'Email verified' : verifying ? 'Verifying your email' : 'Verify your email'}
      </Text>

      {success ? (
        <Banner
          tone="success"
          title="You're all set"
          message="Your email address is verified. You can now book spaces and receive booking updates."
        />
      ) : verifying ? (
        <View style={styles.pendingRow}>
          <ActivityIndicator color={t.brand} />
          <Text style={[styles.pendingText, { color: t.muted }]}>
            One moment while we confirm your address…
          </Text>
        </View>
      ) : (
        <Text style={[styles.body, { color: t.muted }]}>
          {autoRejected
            ? errorMessage
            : 'Enter the verification code from your email to activate booking confirmations and alerts on this account.'}
        </Text>
      )}

      {!verifying && !success && showPasteField ? (
        <View style={styles.form}>
          {manualError ? <Banner tone="danger" message={manualError} /> : null}
          <TextField
            label="Verification code"
            value={manualToken}
            onChangeText={setManualToken}
            placeholder="Paste the code from your email"
            autoCapitalize="none"
            autoCorrect={false}
            hint="It's the long string at the end of the verification link."
          />
          <Button
            label="Verify email"
            onPress={() => manual.mutate(manualToken)}
            disabled={manualToken.trim().length < 8}
            fullWidth
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={success ? 'Continue to sign in' : 'Back to sign in'}
          onPress={() => router.replace('/(auth)/login')}
          variant={success ? 'primary' : 'secondary'}
          fullWidth
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingHorizontal: 24, paddingBottom: 32 },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pendingText: { fontSize: 14 },
  form: { gap: 12, marginTop: 4 },
  actions: { marginTop: 12, gap: 8 },
});
