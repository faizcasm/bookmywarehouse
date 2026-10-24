/** Full-screen loading spinner overlay. */

import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/store/ThemeContext';

export function LoadingOverlay() {
  const t = useTheme();
  return (
    <View style={[styles.base, { backgroundColor: t.bgPage }]} accessibilityLabel="Loading">
      <ActivityIndicator size="large" color={t.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});