/**
 * Chip — the app's selectable pill (filters, types, statuses, reasons).
 *
 * Replaces the copy-pasted `Text onPress` chips that were inlined in ~7 screens
 * so filter affordances look and behave identically everywhere.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Small trailing count, e.g. "Mumbai (12)". */
  count?: number;
  /** Renders a leading dot in this tone — used to convey status chips. */
  dotColor?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Chip({
  label,
  selected = false,
  onPress,
  count,
  dotColor,
  disabled,
  size = 'md',
}: ChipProps) {
  const t = useTheme();

  const background = selected ? t.brandSoft : t.surface3;
  const borderColor = selected ? t.brand : 'transparent';
  const textColor = selected ? t.brandSoftFg : t.fg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: background, borderColor, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text
        style={[styles.label, size === 'sm' && styles.labelSm, { color: textColor }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {typeof count === 'number' ? (
        <Text style={[styles.count, { color: selected ? t.brandSoftFg : t.muted }]}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  sm: { paddingVertical: 6 },
  md: { paddingVertical: 9 },
  label: { fontSize: 14, fontWeight: '600' },
  labelSm: { fontSize: 13 },
  count: { fontSize: 12, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
