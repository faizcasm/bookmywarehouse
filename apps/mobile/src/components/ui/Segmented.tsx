/**
 * Segmented — an iOS-style segmented control for in-page tabs
 * (status filters, form steps, list scopes).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional trailing count shown after the label. */
  count?: number;
}

export interface SegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Stretch each segment to fill the row evenly. */
  equalWidth?: boolean;
}

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  equalWidth = true,
}: SegmentedProps<T>) {
  const t = useTheme();
  return (
    <View
      style={[styles.track, { backgroundColor: t.surface3 }]}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              equalWidth && styles.flex,
              active && [styles.active, { backgroundColor: t.surface, borderColor: t.line }],
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: active ? t.fgStrong : t.muted },
                active && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {option.label}
              {typeof option.count === 'number' ? ` (${option.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segment: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  flex: { flex: 1 },
  active: { shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  label: { fontSize: 13, fontWeight: '600' },
  labelActive: { fontWeight: '700' },
});
