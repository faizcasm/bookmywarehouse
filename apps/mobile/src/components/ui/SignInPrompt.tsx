/**
 * SignInPrompt — the standard "you need an account" state.
 *
 * Every authenticated screen renders this instead of letting a guest's 401
 * clear the session, so deep-linking into favourites/invoices/etc. as a guest
 * shows a prompt rather than kicking the user out of the app.
 */

import { router } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';
import { Button } from './Button';

export interface SignInPromptProps {
  title?: string;
  subtitle?: string;
  /** Where to go back to after signing in (defaults to the profile tab). */
  next?: string;
}

export function SignInPrompt({
  title = 'Sign in to continue',
  subtitle = 'This screen is available once you have an account. It only takes a moment.',
  next = '/(customer)/(tabs)/profile',
}: SignInPromptProps) {
  const t = useTheme();

  return (
    <View style={styles.base}>
      <View style={[styles.iconWrap, { backgroundColor: t.brandSoft }]}>
        <LogIn size={26} color={t.brand} />
      </View>
      <Text style={[styles.title, { color: t.fgStrong }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: t.muted }]}>{subtitle}</Text>
      <View style={styles.actions}>
        <Button
          label="Sign in"
          fullWidth
          onPress={() => router.push({ pathname: '/(auth)/login', params: { next } })}
        />
        <Button
          label="Create an account"
          variant="ghost"
          fullWidth
          onPress={() => router.push({ pathname: '/(auth)/register', params: { next } })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  actions: { alignSelf: 'stretch', gap: 8, marginTop: 14 },
});
