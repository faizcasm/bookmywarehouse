/**
 * Admin stack layout — hosts the mobile-adapted admin console. Non-admins are
 * redirected out.
 */

import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { LoadingOverlay } from '@/components/ui';

export default function AdminLayout() {
  const t = useTheme();
  const { status, user } = useSession();

  if (status === 'loading') return <LoadingOverlay />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== 'ADMIN') return <Redirect href="/(customer)/(tabs)" />;

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
