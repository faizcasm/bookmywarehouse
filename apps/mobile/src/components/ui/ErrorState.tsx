/** Error-state block with a retry action. Maps ApiError codes to friendly copy. */

import { StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { Button } from './Button';
import { useTheme } from '@/store/ThemeContext';
import { ApiError } from '@/services/api/client';

export interface ErrorStateProps {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export function ErrorState({ error, title, onRetry }: ErrorStateProps) {
  const t = useTheme();
  return (
    <View style={styles.base}>
      <Text style={[styles.title, { color: t.fgStrong }]}>{title ?? 'Something went wrong'}</Text>
      <Text style={[styles.msg, { color: t.muted }]}>{messageFor(error)}</Text>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  msg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  action: { marginTop: 12 },
});