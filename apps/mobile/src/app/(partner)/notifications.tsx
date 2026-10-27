/**
 * Partner notifications — unread-aware feed with per-type icons and deep-links
 * into the partner console.
 *
 * The frozen `toNotification` normalizer only captures the first two path
 * segments of a link (`/partner/bookings/<id>` → type `partner`, id
 * `bookings`), so routes below map onto the closest partner screen instead of
 * pretending to resolve an id we don't have.
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
  PackageOpen,
  ShieldAlert,
  Star,
} from 'lucide-react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Button, Card, Screen, SignInPrompt } from '@/components/ui';
import { listNotifications, markNotificationsRead } from '@/services/api/account';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { formatRelativeTime } from '@/utils/format';
import type { Notification } from '@/types';

function IconForType({ type, color }: { type: string; color: string }) {
  const u = (type ?? '').toUpperCase();
  if (u.includes('BOOKING')) return <CalendarCheck size={19} color={color} />;
  if (u.includes('MESSAGE') || u.includes('CONVERSATION')) return <MessageCircle size={19} color={color} />;
  if (u.includes('PAYOUT') || u.includes('PAYMENT') || u.includes('EARNING') || u.includes('REFUND')) {
    return <CreditCard size={19} color={color} />;
  }
  if (u.includes('REVIEW')) return <Star size={19} color={color} />;
  if (u.includes('LISTING')) return <PackageOpen size={19} color={color} />;
  if (u.includes('DISPUTE')) return <ShieldAlert size={19} color={color} />;
  if (u.includes('VERIF')) return <BadgeCheck size={19} color={color} />;
  return <Bell size={19} color={color} />;
}

/** Map the parsed link onto a partner-console route (null = just mark read). */
function routeFor(notification: Notification): string | null {
  const kind = `${notification.linkType ?? ''}/${notification.linkId ?? ''}`.toLowerCase();
  switch (kind) {
    case 'partner/bookings':
    case 'dashboard/bookings':
    case 'bookings':
    case 'booking':
      return '/(partner)/(tabs)/bookings';
    case 'partner/listings':
    case 'listings':
    case 'listing':
      return '/(partner)/(tabs)/listings';
    case 'partner/verification':
    case 'verification':
      return '/(partner)/verification';
    case 'partner/reviews':
    case 'reviews':
    case 'review':
      return '/(partner)/reviews';
    case 'partner/earnings':
    case 'dashboard/earnings':
    case 'earnings':
      return '/(partner)/(tabs)/earnings';
    case 'partner/messages':
    case 'dashboard/messages':
    case 'messages':
    case 'conversations':
    case 'conversation':
      return '/(partner)/(tabs)/messages';
    case 'partner/availability':
    case 'availability':
      return '/(partner)/availability';
    default:
      return null;
  }
}

export default function PartnerNotificationsScreen() {
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
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in for notifications"
          subtitle="Booking requests, review responses and payout alerts appear here."
          next="/(partner)/notifications"
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
            <Text style={{ color: t.muted, fontSize: 13 }}>{unreadCount} unread</Text>
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
        itemHeight={92}
        emptyTitle="No notifications"
        emptySubtitle="Booking requests, messages and payout updates will appear here."
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
