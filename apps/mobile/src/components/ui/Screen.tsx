/** Screen wrapper: safe-area padding, ambient emerald glow and optional scroll. */

import { StyleSheet, View, ScrollView, type ViewStyle } from 'react-native';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/store/ThemeContext';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  /** Apply top safe-area padding (set false when a custom header handles it). */
  padTop?: boolean;
  contentStyle?: ViewStyle;
}

function AmbientGlow() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.emeraldGlow} />
      <View style={styles.blueGlow} />
    </View>
  );
}

export function Screen({ children, scroll, style, padTop = true, contentStyle }: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = {
    paddingTop: padTop ? insets.top : 0,
    paddingBottom: Math.max(insets.bottom, 16),
  };

  if (scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: t.bgPage }]}>
        <AmbientGlow />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, padding, contentStyle, style]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: t.bgPage }, padding, style]}>
      <AmbientGlow />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  emeraldGlow: {
    position: 'absolute',
    top: -100,
    right: -92,
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: 'rgba(16, 185, 129, 0.055)',
  },
  blueGlow: {
    position: 'absolute',
    top: 280,
    left: -144,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(59, 130, 246, 0.035)',
  },
});
