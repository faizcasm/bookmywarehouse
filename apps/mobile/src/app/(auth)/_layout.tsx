/** Auth group layout — public stack for login/register/password flows. */

import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';

export default function AuthLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.bgPage },
      }}
    />
  );
}