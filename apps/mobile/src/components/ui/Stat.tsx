/**
 * Stat — KPI tile for dashboards (customer/partner/admin).
 *
 * `StatGrid` lays tiles out 2-up (or N-up) with consistent gaps so dashboards
 * read the same across the three roles.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';
import { Card } from './Card';

export interface StatProps {
  label: string;
  /** Pre-formatted display value ("₹1.2L", "12", "4.8"). */
  value: string | number;
  hint?: string;
  tone?: 'brand' | 'success' | 'warn' | 'danger' | 'neutral';
  onPress?: () => void;
}

const TONE_KEY = {
  brand: 'brand',
  success: 'success',
  warn: 'warning',
  danger: 'danger',
  neutral: 'neutral',
} as const;

export function Stat({ label, value, hint, tone = 'neutral', onPress }: StatProps) {
  const t = useTheme();
  const color =
    tone === 'neutral' ? t.fgStrong : (t[TONE_KEY[tone]] as string);

  const body = (
    <>
      <Text style={[styles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.label, { color: t.muted }]} numberOfLines={2}>
        {label}
      </Text>
      {hint ? (
        <Text style={[styles.hint, { color: t.faint }]} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.press, pressed && { opacity: 0.85 }]}
      >
        <Card style={styles.card}>{body}</Card>
      </Pressable>
    );
  }
  return <Card style={styles.card}>{body}</Card>;
}

export interface StatGridProps {
  children: React.ReactNode;
  /** Tiles per row. */
  columns?: number;
}

export function StatGrid({ children, columns = 2 }: StatGridProps) {
  return <View style={styles.grid}>{React.Children.map(children, (child) => (
    <View key={(child as { key?: string }).key} style={{ width: `${100 / columns}%`, padding: 6 }}>
      {child}
    </View>
  ))}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  press: { flex: 1 },
  card: { gap: 4, minHeight: 92, justifyContent: 'center' },
  value: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  label: { fontSize: 12.5, fontWeight: '600' },
  hint: { fontSize: 11.5 },
});
