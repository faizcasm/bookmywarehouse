/** Reset-password screen — reads the token from the deep link, sets a new password. */

import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { resetPassword } from '@/services/api/auth';
import { resetPasswordSchema } from '@/schemas';
import type { ResetPasswordInput } from '@/schemas';

export default function ResetPasswordScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: token ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await resetPassword(values.token, values.password);
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: t.fgStrong }]}>Set a new password</Text>

        {done ? (
          <View style={[styles.confirm, { backgroundColor: t.successSoft }]}>
            <Text style={[styles.confirmTitle, { color: t.successSoftFg }]}>Password updated</Text>
            <Text style={{ color: t.successSoftFg }}>You can now sign in with your new password.</Text>
            <Button label="Go to sign in" onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 12 }} />
          </View>
        ) : (
          <>
            {!token ? (
              <View style={[styles.warn, { backgroundColor: t.warningSoft }]}>
                <Text style={{ color: t.warningSoftFg }}>
                  Missing reset token. Open the link from your email, or paste the token below.
                </Text>
              </View>
            ) : null}
            {formError ? (
              <View style={[styles.errorBox, { backgroundColor: t.dangerSoft }]}>
                <Text style={{ color: t.dangerSoftFg }}>{formError}</Text>
              </View>
            ) : null}

            {!token ? (
              <Controller
                control={control}
                name="token"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="Reset token" value={value ?? ''} onChangeText={onChange} onBlur={onBlur} error={errors.token?.message} placeholder="Paste the token" />
                )}
              />
            ) : null}

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField label="New password" value={value ?? ''} onChangeText={onChange} onBlur={onBlur} error={errors.password?.message} secureTextEntry hint="At least 8 characters with a letter and a number" />
              )}
            />
            <Button label="Update password" onPress={onSubmit} loading={isSubmitting} fullWidth />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  errorBox: { padding: 12, borderRadius: 12 },
  warn: { padding: 12, borderRadius: 12 },
  confirm: { padding: 16, borderRadius: 16, gap: 8 },
  confirmTitle: { fontSize: 18, fontWeight: '700' },
});