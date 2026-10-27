/**
 * Partner console layout — bottom tabs for the primary partner journeys
 * (dashboard, listings, bookings, earnings, more).
 *
 * Bookings carries the pending-request badge fed by the shared dashboard KPIs.
 * Messages stays routable from the dashboard and the More menu, but is hidden
 * from the bar so five tabs stay legible.
 */

import { Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, IndianRupee, LayoutGrid, MoreHorizontal, Warehouse } from 'lucide-react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';
import { getPartnerDashboard } from '@/services/api/partner';

export default function PartnerTabsLayout() {
  const t = useTheme();

  const dashboard = useQuery({
    queryKey: ['partner-dashboard'],
    queryFn: getPartnerDashboard,
    staleTime: 30_000,
  });

  const pending = dashboard.data?.pendingBookings ?? 0;
  const pendingBadge = pending > 0 ? (pending > 99 ? '99+' : String(pending)) : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.brand,
        tabBarInactiveTintColor: t.faint,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarBadgeStyle: {
          backgroundColor: t.danger,
          color: '#ffffff',
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <LayoutGrid size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Listings',
          tabBarIcon: ({ color }) => <Warehouse size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarBadge: pendingBadge,
          tabBarIcon: ({ color }) => <CalendarDays size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color }) => <IndianRupee size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <MoreHorizontal size={24} color={color} strokeWidth={2} />,
        }}
      />
      {/* Hidden from the bar but still routable (dashboard / More menu). */}
      <Tabs.Screen name="messages" options={{ title: 'Messages', href: null }} />
    </Tabs>
  );
}
