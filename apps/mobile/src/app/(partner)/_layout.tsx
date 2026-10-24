/**
 * Partner stack layout — hosts the partner console. Guests and non-partners are
 * bounced to login; the group is only reachable with a PARTNER session.
 */

import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { LoadingOverlay } from '@/components/ui';

export default function PartnerLayout() {
  const t = useTheme();
  const { status, user } = useSession();

  if (status === 'loading') return <LoadingOverlay />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== 'PARTNER') return <Redirect href="/(customer)/(tabs)" />;

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
