/**
 * MiniChart — dependency-free dashboard charts (columns + sparkline) built from
 * plain Views, so they inherit theming with no SVG/native chart library.
 *
 * Both take pre-formatted series data; the caller owns formatting so numbers
 * stay consistent with `formatMoney` / `formatNumber` elsewhere in the app.
 */

import { StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';

export interface SeriesPoint {
  label: string;
  value: number;
  /** Optional pre-formatted value shown on the tallest bar / on press. */
  display?: string;
}

export interface ColumnChartProps {
  data: SeriesPoint[];
  height?: number;
  /** Bar for the peak value (used for the emphasis colour). */
  accent?: boolean;
  /** Render compactly (no axis labels) — for small dashboard tiles. */
  compact?: boolean;
}

export function ColumnChart({ data, height = 132, accent = true, compact }: ColumnChartProps) {
  const t = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <View>
      <View style={[styles.columns, { height }]}>
        {data.map((point, index) => {
          const ratio = point.value / max;
          const isPeak = accent && point.value === max && point.value > 0;
          return (
            <View key={`${point.label}-${index}`} style={styles.columnWrap}>
              <Text
                style={[styles.value, { color: isPeak ? t.brand : t.muted }]}
                numberOfLines={1}
              >
                {point.display ?? point.value}
              </Text>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, ratio * (height - 34)),
                    backgroundColor: isPeak ? t.brand : t.surface3,
                    borderRadius: 6,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      {compact ? null : (
        <View style={styles.labels}>
          {data.map((point, index) => (
            <Text
              key={`${point.label}-lbl-${index}`}
              style={[styles.label, { color: t.faint }]}
              numberOfLines={1}
            >
              {point.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

export interface SparklineProps {
  values: number[];
  height?: number;
  /** Show the total at the right edge. */
  caption?: string;
}

/** A compact trend strip (mini columns) — used for "last N days" tiles. */
export function Sparkline({ values, height = 44, caption }: SparklineProps) {
  const t = useTheme();
  const max = Math.max(1, ...values);

  return (
    <View style={styles.sparkRow}>
      <View style={[styles.sparkTrack, { height }]}>
        {values.map((value, index) => (
          <View
            key={`spark-${index}`}
            style={[
              styles.sparkBar,
              {
                height: Math.max(3, (value / max) * height),
                backgroundColor: index === values.length - 1 ? t.brand : t.brandSoft,
                borderRadius: 3,
              },
            ]}
          />
        ))}
      </View>
      {caption ? (
        <Text style={[styles.caption, { color: t.muted }]}>{caption}</Text>
      ) : null}
    </View>
  );
}

export interface DonutLikeProps {
  ratio: number;
  label: string;
}

/**
 * RatioBar — a single labelled progress bar (utilisation, response rate,
 * verification completion). Simpler and more legible than a donut at 40pt.
 */
export function RatioBar({ ratio, label }: DonutLikeProps) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, ratio));
  return (
    <View style={styles.ratioWrap}>
      <View style={[styles.ratioTrack, { backgroundColor: t.surface3 }]}>
        <View
          style={[
            styles.ratioFill,
            { backgroundColor: t.brand, width: `${pct * 100}%` },
          ]}
        />
      </View>
      <Text style={[styles.ratioLabel, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

/** Convenience wrapper giving a chart a themed, bordered card. */
export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: t.fgStrong }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.cardSubtitle, { color: t.muted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  columnWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '100%' },
  value: { fontSize: 9.5, fontWeight: '700' },
  labels: { flexDirection: 'row', gap: 6, marginTop: 6 },
  label: { flex: 1, fontSize: 10, textAlign: 'center' },
  sparkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sparkTrack: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  sparkBar: { flex: 1 },
  caption: { fontSize: 12, fontWeight: '600' },
  ratioWrap: { gap: 6 },
  ratioTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  ratioFill: { height: '100%', borderRadius: 4 },
  ratioLabel: { fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  cardHeader: { gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSubtitle: { fontSize: 12.5 },
});
