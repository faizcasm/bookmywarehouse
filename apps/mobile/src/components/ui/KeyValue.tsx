/** KeyValue — a definition list for detail screens (specs, pricing, KYC). */

import { StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';

export interface KeyValueItem {
  label: string;
  value: React.ReactNode;
  /** Render on its own full-width line (long addresses, notes). */
  block?: boolean;
}

export interface KeyValueProps {
  items: KeyValueItem[];
  /** `row` = label left / value right (tables). `stack` = label above value. */
  layout?: 'row' | 'stack';
}

export function KeyValue({ items, layout = 'row' }: KeyValueProps) {
  const t = useTheme();

  return (
    <View style={styles.wrap}>
      {items.map((item, index) => (
        <View
          key={`${item.label}-${index}`}
          style={[
            styles.item,
            layout === 'row' ? styles.rowLayout : styles.stackLayout,
            item.block && styles.block,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line },
          ]}
        >
          <Text style={[styles.label, { color: t.muted }]}>{item.label}</Text>
          <View style={styles.valueWrap}>
            {typeof item.value === 'string' || typeof item.value === 'number' ? (
              <Text style={[styles.value, { color: t.fgStrong }]}>{item.value}</Text>
            ) : (
              item.value
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  item: { paddingVertical: 10, gap: 4 },
  rowLayout: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  stackLayout: { flexDirection: 'column' },
  block: { flexDirection: 'column', gap: 4 },
  label: { fontSize: 13.5, fontWeight: '500', flexShrink: 1 },
  valueWrap: { flexShrink: 1, alignItems: 'flex-end' },
  value: { fontSize: 14.5, fontWeight: '600', textAlign: 'right' },
});
