/**
 * Entry redirect — sends the user to the right experience based on session and
 * role. Guests land on the customer home; partners and admins go to their
 * consoles. Mirrors how the three web SPAs guard their own routes.
 */

import { Redirect } from 'expo-router';
import React from 'react';

import { LoadingOverlay } from '@/components/ui';
import { useSession } from '@/store/SessionContext';

export default function Index() {
  const { status, user } = useSession();

  if (status === 'loading') return <LoadingOverlay />;

  if (!user) return <Redirect href="/(auth)/login" />;

  if (user.role === 'ADMIN') return <Redirect href="/(admin)/(tabs)" />;
  if (user.role === 'PARTNER') return <Redirect href="/(partner)/(tabs)" />;

  return <Redirect href="/(customer)/(tabs)" />;
}