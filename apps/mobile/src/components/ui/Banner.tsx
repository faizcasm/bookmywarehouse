/**
 * Banner — inline notice strip (maintenance mode, platform announcements,
 * verification warnings, offline hints).
 */

import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { Info, TriangleAlert, CheckCircle2, XCircle } from 'lucide-react-native';

import { useTheme } from '@/store/ThemeContext';
import { Button } from './Button';

export type BannerTone = 'info' | 'warn' | 'success' | 'danger';

export interface BannerProps {
  tone?: BannerTone;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const ICONS: Record<BannerTone, React.ComponentType<{ size?: number; color?: string }>> = {
  info: Info,
  warn: TriangleAlert,
  success: CheckCircle2,
  danger: XCircle,
};

export function Banner({ tone = 'info', title, message, actionLabel, onAction }: BannerProps) {
  const t = useTheme();
  const Icon = ICONS[tone];

  const palette = {
    info: { bg: t.infoSoft, fg: t.infoSoftFg },
    warn: { bg: t.warningSoft, fg: t.warningSoftFg },
    success: { bg: t.successSoft, fg: t.successSoftFg },
    danger: { bg: t.dangerSoft, fg: t.dangerSoftFg },
  }[tone];

  return (
    <View style={[styles.base, { backgroundColor: palette.bg }]}>
      <Icon size={18} color={palette.fg} />
      <View style={styles.body}>
        {title ? <Text style={[styles.title, { color: palette.fg }]}>{title}</Text> : null}
        <Text style={[styles.message, { color: palette.fg }]}>{message}</Text>
        {actionLabel && onAction ? (
          <Button
            label={actionLabel}
            variant="secondary"
            onPress={onAction}
            style={styles.action}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    alignItems: 'flex-start',
  },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: '700' },
  message: { fontSize: 13.5, lineHeight: 19 },
  action: { marginTop: 6, alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 14 },
});
