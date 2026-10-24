/**
 * Partner console layout — bottom tabs for the primary partner journeys
 * (dashboard, listings, bookings, messages, more).
 */

import { Tabs } from 'expo-router';
import { LayoutGrid, Warehouse, CalendarDays, MessageSquare, MoreHorizontal } from 'lucide-react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';

export default function PartnerTabsLayout() {
  const t = useTheme();

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
        options={{ title: 'Overview', tabBarIcon: ({ color }) => <LayoutGrid size={24} color={color} strokeWidth={2} /> }}
      />
      <Tabs.Screen
        name="listings"
        options={{ title: 'Listings', tabBarIcon: ({ color }) => <Warehouse size={24} color={color} strokeWidth={2} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: 'Bookings', tabBarIcon: ({ color }) => <CalendarDays size={24} color={color} strokeWidth={2} /> }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: 'Messages', tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} strokeWidth={2} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: ({ color }) => <MoreHorizontal size={24} color={color} strokeWidth={2} /> }}
      />
    </Tabs>
  );
}
