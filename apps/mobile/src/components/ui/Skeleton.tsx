/** Shimmer-style skeleton placeholder block. */

import { useEffect, useState } from 'react';
import { Animated, Easing, View, type DimensionValue, type ViewStyle } from 'react-native';

import { useTheme } from '@/store/ThemeContext';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const t = useTheme();
  // Lazy-init the Animated.Value via useState so we never read a ref during render.
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const base: ViewStyle = {
    width,
    height,
    borderRadius: radius,
    backgroundColor: t.surface3,
    overflow: 'hidden',
  };

  return (
    <Animated.View style={[base, style, { opacity }]}>
      <View style={{ flex: 1 }} />
    </Animated.View>
  );
}
