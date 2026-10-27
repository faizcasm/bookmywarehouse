/**
 * StarRating — read-only rating display and an interactive 1–5 input.
 *
 * Uses a two-layer trick (grey stars under brand stars clipped to a %) so half
 * ratings render correctly without needing SVG.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { Star } from 'lucide-react-native';

import { useTheme } from '@/store/ThemeContext';

export interface StarRatingProps {
  rating: number;
  size?: number;
  count?: number;
  /** When provided the component becomes tappable and reports 1–5. */
  onChange?: (rating: number) => void;
  showValue?: boolean;
}

export function StarRating({ rating, size = 16, count, onChange, showValue }: StarRatingProps) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(5, rating));
  const percent = (clamped / 5) * 100;

  const renderRow = (color: string) => (
    <View style={styles.row} pointerEvents="none">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} color={color} fill={color} />
      ))}
    </View>
  );

  if (onChange) {
    return (
      <View style={styles.row} accessibilityRole="adjustable">
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
            onPress={() => onChange(star)}
            style={({ pressed }) => pressed && { opacity: 0.7, transform: [{ scale: 1.12 }] }}
          >
            <Star
              size={size + 8}
              color={star <= clamped ? t.warning : t.lineStrong}
              fill={star <= clamped ? t.warning : 'transparent'}
            />
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View>
        {renderRow(t.lineStrong)}
        <View style={[styles.overlay, { width: `${percent}%`, overflow: 'hidden' }]}>
          {renderRow(t.warning)}
        </View>
      </View>
      {showValue && clamped > 0 ? (
        <Text style={[styles.value, { color: t.fg, fontSize: size * 0.85 }]}>
          {clamped.toFixed(1)}
        </Text>
      ) : null}
      {typeof count === 'number' ? (
        <Text style={[styles.count, { color: t.muted, fontSize: size * 0.8 }]}>
          ({count})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  overlay: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  value: { fontWeight: '700', marginLeft: 4 },
  count: { fontWeight: '500' },
});
