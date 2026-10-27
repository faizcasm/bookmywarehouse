/**
 * LinkRow — a tappable settings/menu row (icon + label + trailing value).
 *
 * Used by Profile / More screens so navigation affordances stay consistent
 * instead of being re-styled per screen.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/store/ThemeContext';

export interface LinkRowProps {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  /** Trailing text (current value, status, …). */
  value?: string;
  /** Unread / attention count rendered as a pill. */
  badge?: number;
  danger?: boolean;
  /** Hide the chevron (non-navigational rows). */
  hideChevron?: boolean;
  subtitle?: string;
}

export function LinkRow({
  label,
  onPress,
  icon,
  value,
  badge,
  danger,
  hideChevron,
  subtitle,
}: LinkRowProps) {
  const t = useTheme();
  const labelColor = danger ? t.danger : t.fg;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: t.surface, borderColor: t.line },
        pressed && onPress && { backgroundColor: t.surface2 },
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.text}>
        <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: t.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.value, { color: t.muted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {typeof badge === 'number' && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: t.brand }]}>
          <Text style={[styles.badgeText, { color: t.brandFg }]}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      {hideChevron ? null : (
        <ChevronRight size={18} color={t.faint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  icon: { width: 24, alignItems: 'center' },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 12.5 },
  value: { fontSize: 13, maxWidth: '45%', textAlign: 'right' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
