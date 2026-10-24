/** Edit profile — name, phone. */

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { Button, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { updateProfile } from '@/services/api/account';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9][0-9 -]{7,16}$/, 'Enter a valid phone number')
    .nullish()
    .or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function EditProfileScreen() {
  const t = useTheme();
  const { user, refreshUser } = useSession();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      phone: user?.phone ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await updateProfile({ fullName: values.fullName, phone: values.phone || null });
      await refreshUser();
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes.');
    }
  });

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: t.fgStrong }]}>Edit profile</Text>
      {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
      <Controller
        control={control}
        name="fullName"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Full name"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.fullName?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Phone"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.phone?.message}
            keyboardType="phone-pad"
            placeholder="+91 98765 43210"
          />
        )}
      />
      <Button label="Save changes" onPress={onSubmit} loading={isSubmitting} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800' },
});
