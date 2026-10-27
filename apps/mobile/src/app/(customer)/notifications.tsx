/**
 * Notifications — paginated feed with per-type icons, unread styling and
 * deep-links into the screen each notification refers to.
 */

import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BadgeCheck,
  Bell,
  CalendarCheck,
  CreditCard,
  MessageCircle,
  ShieldAlert,
  Star,
} from 'lucide-react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Button, Card, Screen, SignInPrompt } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { listNotifications, markNotificationsRead } from '@/services/api/account';
import { formatRelativeTime } from '@/utils/format';
import type { Notification } from '@/types';

/** Map a notification type to the most relevant lucide glyph. */
function IconForType({ type, color }: { type: string; color: string }) {
  const u = (type ?? '').toUpperCase();
  if (u.includes('BOOKING')) return <CalendarCheck size={19} color={color} />;
  if (u.includes('MESSAGE') || u.includes('CONVERSATION')) return <MessageCircle size={19} color={color} />;
  if (u.includes('PAYMENT') || u.includes('INVOICE') || u.includes('REFUND')) {
    return <CreditCard size={19} color={color} />;
  }
  if (u.includes('REVIEW')) return <Star size={19} color={color} />;
  if (u.includes('DISPUTE')) return <ShieldAlert size={19} color={color} />;
  if (u.includes('VERIF')) return <BadgeCheck size={19} color={color} />;
  return <Bell size={19} color={color} />;
}

/** Where a notification's link should take the customer (null = just mark read). */
function routeFor(notification: Notification): string | null {
  const id = notification.linkId ?? '';
  switch ((notification.linkType ?? '').toLowerCase()) {
    case 'booking':
    case 'bookings':
      return id ? `/(customer)/booking/${id}` : null;
    case 'listing':
    case 'listings':
      return id ? `/(customer)/listing/${id}` : null;
    case 'conversation':
    case 'conversations':
    case 'message':
    case 'messages':
      return id ? `/(customer)/conversation/${id}` : null;
    case 'invoice':
    case 'invoices':
      return '/(customer)/invoices';
    case 'payment':
    case 'payments':
      return '/(customer)/payments';
    case 'review':
    case 'reviews':
      return '/(customer)/reviews';
    case 'dispute':
    case 'disputes':
      return '/(customer)/disputes';
    default:
      return null;
  }
}

export default function NotificationsScreen() {
  const t = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  const markAll = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: invalidate,
  });

  const markOne = useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead(ids),
    onSuccess: invalidate,
  });

  const unread = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const res = await listNotifications({ page: 1, limit: 50 });
      return res.items.filter((n) => !n.read).length;
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in for notifications"
          subtitle="Booking updates, messages and payment alerts appear here."
          next="/(customer)/notifications"
        />
      </Screen>
    );
  }

  const unreadCount = unread.data ?? 0;

  const openNotification = (n: Notification) => {
    if (!n.read) markOne.mutate([n.id]);
    const route = routeFor(n);
    if (route) router.push(route as never);
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.heading, { color: t.fgStrong }]}>Notifications</Text>
          {unreadCount > 0 ? (
            <Text style={{ color: t.muted, fontSize: 13 }}>
              {unreadCount} unread
            </Text>
          ) : null}
        </View>
        <Button
          label="Mark all read"
          variant="ghost"
          onPress={() => markAll.mutate()}
          loading={markAll.isPending}
          disabled={unreadCount === 0}
        />
      </View>

      <PaginatedList<Notification>
        queryKey={['notifications']}
        fetchPage={(page) => listNotifications({ page })}
        keyExtractor={(n) => n.id}
        itemHeight={88}
        emptyTitle="No notifications"
        emptySubtitle="Booking updates and messages will appear here."
        renderItem={(n) => (
          <Card
            onPress={() => openNotification(n)}
            style={{
              ...styles.row,
              ...(!n.read ? { backgroundColor: t.brandSoft, borderColor: t.brand } : null),
            }}
          >
            <View style={[styles.icon, { backgroundColor: n.read ? t.surface3 : t.surface }]}>
              <IconForType type={n.type} color={n.read ? t.faint : t.brandSoftFg} />
            </View>
            <View style={styles.body}>
              <Text
                style={[styles.title, { color: n.read ? t.muted : t.fgStrong }]}
                numberOfLines={1}
              >
                {n.title}
              </Text>
              {n.body ? (
                <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={2}>
                  {n.body}
                </Text>
              ) : null}
              <Text style={{ color: t.faint, fontSize: 12 }}>
                {formatRelativeTime(n.createdAt)}
              </Text>
            </View>
            {n.read ? null : <View style={[styles.dot, { backgroundColor: t.brand }]} />}
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  headerText: { gap: 2 },
  heading: { fontSize: 22, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
