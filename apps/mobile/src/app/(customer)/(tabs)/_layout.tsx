/**
 * Customer tab layout — bottom tabs for the primary customer journeys.
 * Home and Search are public (guests can browse); Bookings, Messages and
 * Profile require a session and are guarded per-screen.
 *
 * The Messages tab carries an unread badge fed by the first page of the
 * conversation list (cheap, cached, and shared with the Messages screen).
 */

import { Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { House, Search, CalendarDays, MessageSquare, User } from 'lucide-react-native';
import React from 'react';

import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { listConversations } from '@/services/api/account';

export default function CustomerTabsLayout() {
  const t = useTheme();
  const { user } = useSession();

  const unread = useQuery({
    queryKey: ['conversations-unread'],
    queryFn: async () => {
      const res = await listConversations({ page: 1 });
      return res.items.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const unreadCount = unread.data ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.brand,
        tabBarInactiveTintColor: t.faint,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.line,
        },
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
          title: 'Explore',
          tabBarIcon: ({ color }) => <House size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Search size={24} color={color} strokeWidth={2} />,
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
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} strokeWidth={2} />,
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={24} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
