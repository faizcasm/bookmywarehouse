/** Full-screen loading spinner overlay. */

import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '@/store/ThemeContext';

export function LoadingOverlay() {
  const t = useTheme();
  return (
    <View style={[styles.base, { backgroundColor: t.bgPage }]} accessibilityLabel="Loading">
      <Image source={require('../../../assets/images/icon.png')} style={styles.logo} contentFit="cover" />
      <ActivityIndicator size="large" color={t.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  logo: { width: 76, height: 76, borderRadius: 20 },
});