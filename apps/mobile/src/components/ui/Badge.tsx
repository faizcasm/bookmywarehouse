/** Status badge with tone-driven colours (soft background + strong text). */

import { StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';
import type { ThemeTokens } from '@/theme/tokens';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'accent';

function toneColors(t: ThemeTokens, tone: BadgeTone): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: t.successSoft, fg: t.successSoftFg };
    case 'warn':
      return { bg: t.warningSoft, fg: t.warningSoftFg };
    case 'danger':
      return { bg: t.dangerSoft, fg: t.dangerSoftFg };
    case 'info':
      return { bg: t.infoSoft, fg: t.infoSoftFg };
    case 'accent':
      return { bg: t.accentSoft, fg: t.accentSoftFg };
    default:
      return { bg: t.neutralSoft, fg: t.neutralSoftFg };
  }
}

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const t = useTheme();
  const c = toneColors(t, tone);
  return (
    <View style={[styles.base, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  label: { fontSize: 12, fontWeight: '600' },
});