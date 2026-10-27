/** Primary / secondary / ghost / danger button. 48pt touch target. */

import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  fullWidth,
  style,
  testID,
}: ButtonProps) {
  const t = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? t.brand
      : variant === 'danger'
        ? t.danger
        : variant === 'secondary'
          ? t.surface3
          : 'transparent';
  const fg =
    variant === 'primary'
      ? t.brandFg
      : variant === 'danger'
        ? '#ffffff'
        : variant === 'secondary'
          ? t.fgStrong
          : t.brand;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1 },
        pressed && !isDisabled && { transform: [{ scale: 0.985 }] },
        variant === 'primary' && styles.primaryShadow,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  primaryShadow: {
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  label: { fontSize: 16, fontWeight: '600' },
});
