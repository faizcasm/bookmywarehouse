/** Login screen — email + password, role-aware redirect on success. */

import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { ApiError } from '@/services/api/client';
import { loginSchema, type LoginInput } from '@/schemas';
import { homeFor, safeNext } from '@/utils/navigation';

export default function LoginScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { login } = useSession();
  const params = useLocalSearchParams<{ next?: string }>();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values);
      // Honour an explicit destination (deep link / gated screen), else route by role.
      const target = safeNext(params.next, homeFor(user.role));
      router.replace(target as never);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues.length) {
          for (const issue of err.issues) {
            if (issue.path) setError(issue.path as keyof LoginInput, { message: issue.message });
          }
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError(err instanceof Error ? err.message : 'Unable to reach the API. Check that the API is running and try again.');
      }
    }
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image source={require('../../../assets/images/icon.png')} style={styles.logo} contentFit="cover" />
          <Text style={[styles.brand, { color: t.brand }]}>BookMyWarehouse</Text>
          <Text style={[styles.title, { color: t.fgStrong }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: t.muted }]}>Sign in to manage your bookings.</Text>
        </View>

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
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@example.com"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              secureTextEntry
              autoComplete="password"
              placeholder="Your password"
            />
          )}
        />

        <Button label="Sign in" onPress={onSubmit} loading={isSubmitting} fullWidth />

        <View style={styles.links}>
          <Link href="/(auth)/forgot-password" style={{ color: t.brand }}>
            Forgot password?
          </Link>
        </View>

        <View style={styles.footer}>
          <Text style={{ color: t.muted }}>Don&apos;t have an account? </Text>
          <Link href="/(auth)/register" style={{ color: t.brand, fontWeight: '600' }}>
            Create one
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, gap: 16 },
  header: { gap: 4, marginBottom: 8 },
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 8 },
  brand: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15 },
  errorBox: { padding: 12, borderRadius: 12 },
  links: { alignItems: 'center', marginTop: 4 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
});