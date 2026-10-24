/** Screen wrapper: safe-area padding, themed background, optional scroll. */

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

export function Screen({ children, scroll, style, padTop = true, contentStyle }: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = {
    paddingTop: padTop ? insets.top : 0,
    paddingBottom: Math.max(insets.bottom, 16),
  };

  if (scroll) {
    return (
      <ScrollView
        style={[styles.flex, { backgroundColor: t.bgPage }]}
        contentContainerStyle={[styles.scrollContent, padding, contentStyle, style]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.flex, { backgroundColor: t.bgPage }, padding, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
});