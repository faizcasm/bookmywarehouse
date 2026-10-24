/**
 * Customer stack layout — hosts the bottom tabs plus pushed detail screens
 * (listing detail, booking detail, invoices, favorites, reviews, notifications,
 * disputes, profile sub-screens, legal pages).
 */

import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';

export default function CustomerLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.bgPage },
        animation: 'slide_from_right',
      }}
    />
  );
}