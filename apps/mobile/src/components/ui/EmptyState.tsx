/** Empty-state block: icon slot, title, subtitle and an optional action. */

import { StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { Button } from './Button';
import { useTheme } from '@/store/ThemeContext';

export interface EmptyStateProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({ title, subtitle, actionLabel, onAction, icon }: EmptyStateProps) {
  const t = useTheme();
  return (
    <View style={styles.base}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.title, { color: t.fgStrong }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: t.muted }]}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  icon: { marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  action: { marginTop: 12 },
});