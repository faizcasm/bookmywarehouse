/** Premium acrylic/glass surface card with a soft highlight and safe pressed state. */
 
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
    // Translucent acrylic gives the app a glass finish without requiring a GPU blur
    // view on every card. This is substantially cheaper on mid-range Android devices.
    backgroundColor: t.name === 'dark' ? 'rgba(24, 24, 24, 0.88)' : 'rgba(255, 255, 255, 0.82)',
    borderColor: t.name === 'dark' ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderRadius: t.radiusXl,
    ...(elevated ? shadows.md : shadows.sm),
    ...(padded ? { padding: 16 } : null),
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          base,
          { transform: [{ scale: pressed ? 0.992 : 1 }], opacity: pressed ? 0.94 : 1 },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[base, style]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 14,
          right: 14,
          height: 1,
          backgroundColor: t.name === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.95)',
        }}
      />
      {children}
    </View>
  );
}
