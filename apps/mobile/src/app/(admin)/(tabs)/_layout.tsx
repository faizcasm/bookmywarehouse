/**
 * Admin console layout — bottom tabs for the primary admin journeys. Dense
 * tables from the web console are adapted to card lists here, and the pending
 * KYC / moderation queues surface as tab badges off the shared dashboard query.
 */

import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import {
  CalendarDays,
  LayoutGrid,
  MoreHorizontal,
  Users,
  Warehouse,
} from 'lucide-react-native';
import React from 'react';

import { getAdminDashboard } from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';

export default function AdminTabsLayout() {
  const t = useTheme();
  const { user } = useSession();

  // Same query key as the dashboard screen — the payload is fetched once and
  // reused, this layout only reads it for the pending-work badges.
  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    enabled: !!user,
    staleTime: 30_000,
  });

  const pendingVerifications = dashboard.data?.totals.pendingVerifications ?? 0;
  const pendingListings = dashboard.data?.totals.pendingListings ?? 0;

  const badge = (count: number): string | undefined =>
    count > 0 ? (count > 99 ? '99+' : String(count)) : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.brand,
        tabBarInactiveTintColor: t.faint,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          tabBarBadge: badge(pendingVerifications),
          tabBarIcon: ({ color }) => <LayoutGrid size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Listings',
          tabBarBadge: badge(pendingListings),
          tabBarIcon: ({ color }) => <Warehouse size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color }) => <CalendarDays size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color }) => <Users size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <MoreHorizontal size={24} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
