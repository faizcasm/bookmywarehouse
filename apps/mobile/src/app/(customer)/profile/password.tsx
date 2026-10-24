/** Change password. */

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text } from 'react-native';

import { Button, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { changePasswordSchema, type ChangePasswordInput } from '@/schemas';
import { changePassword } from '@/services/api/auth';
import { ApiError } from '@/services/api/client';

export default function ChangePasswordScreen() {
  const t = useTheme();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      Alert.alert('Password changed', 'Use your new password next time you sign in.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) {
        for (const issue of err.issues) {
          if (issue.path) setFieldError(issue.path as keyof ChangePasswordInput, { message: issue.message });
        }
      } else {
        setError(err instanceof Error ? err.message : 'Could not change password.');
      }
    }
  });

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: t.fgStrong }]}>Change password</Text>
      {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
      <Controller
        control={control}
        name="currentPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Current password"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.currentPassword?.message}
            secureTextEntry
          />
        )}
      />
      <Controller
        control={control}
        name="newPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="New password"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.newPassword?.message}
            secureTextEntry
            hint="At least 8 characters with a letter and a number"
          />
        )}
      />
      <Button label="Update password" onPress={onSubmit} loading={isSubmitting} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800' },
});
