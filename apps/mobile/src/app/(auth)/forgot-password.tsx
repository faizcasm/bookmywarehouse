/** Forgot-password screen — submits email, shows a confirmation state. */

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { forgotPassword } from '@/services/api/auth';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/schemas';

export default function ForgotPasswordScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await forgotPassword(values.email);
      setSent(true);
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
        <Text style={[styles.title, { color: t.fgStrong }]}>Reset your password</Text>

        {sent ? (
          <View style={[styles.confirm, { backgroundColor: t.successSoft }]}>
            <Text style={[styles.confirmTitle, { color: t.successSoftFg }]}>Check your email</Text>
            <Text style={{ color: t.successSoftFg }}>
              If an account exists for that address, we&apos;ve sent a link to reset your password.
            </Text>
            <Button label="Back to sign in" onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 12 }} />
          </View>
        ) : (
          <>
            <Text style={{ color: t.muted }}>
              Enter your account email and we&apos;ll send you a reset link.
            </Text>
            {formError ? (
              <View style={[styles.errorBox, { backgroundColor: t.dangerSoft }]}>
                <Text style={{ color: t.dangerSoftFg }}>{formError}</Text>
              </View>
            ) : null}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Email"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                />
              )}
            />
            <Button label="Send reset link" onPress={onSubmit} loading={isSubmitting} fullWidth />
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
  confirm: { padding: 16, borderRadius: 16, gap: 8 },
  confirmTitle: { fontSize: 18, fontWeight: '700' },
});