/** Avatar — image with an initials fallback, in brand-tinted colours. */

import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';

export interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function Avatar({ uri, name, size = 44 }: AvatarProps) {
  const t = useTheme();
  const radius = size / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={160}
        accessibilityLabel={name ?? 'Avatar'}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: t.brandSoft },
      ]}
    >
      <Text style={[styles.text, { color: t.brandSoftFg, fontSize: size * 0.36 }]}>
        {name ? initials(name) : '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700' },
});
