/** Section header — bold title with an optional trailing action link. */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: t.fgStrong }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.action, { color: t.brand }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  action: { fontSize: 14, fontWeight: '700' },
});
