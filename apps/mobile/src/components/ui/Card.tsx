/** Surface card with themed border, radius and shadow. */

import { Pressable, View, type ViewStyle } from 'react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';
import { shadows } from '@/theme/tokens';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ children, onPress, style, padded = true, elevated }: CardProps) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.surface,
    borderColor: t.line,
    borderWidth: 1,
    borderRadius: t.radiusLg,
    ...(elevated ? shadows.md : shadows.sm),
    ...(padded ? { padding: 16 } : null),
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}