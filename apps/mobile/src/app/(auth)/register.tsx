/** Register screen — customer/partner role picker, TOU checkbox. */

import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { ApiError } from '@/services/api/client';
import { registerSchema, type RegisterInput } from '@/schemas';

export default function RegisterScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { register } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'CUSTOMER' },
  });

  const role = watch('role');
  const accepted = watch('acceptTerms' as keyof RegisterInput) as boolean | undefined;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await register(values);
      if (user.role === 'PARTNER') router.replace('/(partner)/dashboard');
      else router.replace('/(customer)/(tabs)');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues.length) {
          for (const issue of err.issues) {
            if (issue.path) setError(issue.path as keyof RegisterInput, { message: issue.message });
          }
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.brand, { color: t.brand }]}>BookMyWarehouse</Text>
          <Text style={[styles.title, { color: t.fgStrong }]}>Create your account</Text>
        </View>

        {formError ? (
          <View style={[styles.errorBox, { backgroundColor: t.dangerSoft }]}>
            <Text style={{ color: t.dangerSoftFg }}>{formError}</Text>
          </View>
        ) : null}

        <View style={styles.roleRow}>
          {(['CUSTOMER', 'PARTNER'] as const).map((r) => {
            const active = role === r;
            return (
              <Pressable
                key={r}
                onPress={() => setValue('role', r)}
                style={[
                  styles.roleChip,
                  { borderColor: active ? t.brand : t.line, backgroundColor: active ? t.brandSoft : t.surface },
                ]}
              >
                <Text style={{ color: active ? t.brandSoftFg : t.muted, fontWeight: '600' }}>
                  {r === 'CUSTOMER' ? 'Find space' : 'List space'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField label="Full name" value={value ?? ''} onChangeText={onChange} onBlur={onBlur} error={errors.name?.message} placeholder="Jane Doe" />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField label="Email" value={value ?? ''} onChangeText={onChange} onBlur={onBlur} error={errors.email?.message} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField label="Phone (optional)" value={value ?? ''} onChangeText={onChange} onBlur={onBlur} error={errors.phone?.message} keyboardType="phone-pad" placeholder="+91 98765 43210" />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField label="Password" value={value ?? ''} onChangeText={onChange} onBlur={onBlur} error={errors.password?.message} secureTextEntry hint="At least 8 characters with a letter and a number" />
          )}
        />

        <Pressable
          onPress={() => setValue('acceptTerms' as keyof RegisterInput, !accepted as never)}
          style={styles.checkRow}
          accessibilityRole="checkbox"
        >
          <View style={[styles.checkbox, { borderColor: accepted ? t.brand : t.line, backgroundColor: accepted ? t.brand : 'transparent' }]}>
            {accepted ? <Text style={{ color: t.brandFg, fontSize: 12 }}>✓</Text> : null}
          </View>
          <Text style={[styles.checkLabel, { color: t.muted }]}>
            I agree to the <Link href="/(customer)/terms" style={{ color: t.brand }}>Terms</Link> and{' '}
            <Link href="/(customer)/privacy" style={{ color: t.brand }}>Privacy Policy</Link>
          </Text>
        </Pressable>

        <Button label="Create account" onPress={onSubmit} loading={isSubmitting} fullWidth />

        <View style={styles.footer}>
          <Text style={{ color: t.muted }}>Already have an account? </Text>
          <Link href="/(auth)/login" style={{ color: t.brand, fontWeight: '600' }}>Sign in</Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, gap: 16 },
  header: { gap: 4, marginBottom: 8 },
  brand: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: '700' },
  errorBox: { padding: 12, borderRadius: 12 },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
});