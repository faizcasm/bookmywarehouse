/**
 * Profile tab — account header, settings menu, appearance and sign out.
 *
 * Menu rows use the shared `LinkRow` primitive so navigation affordances stay
 * identical to the rest of the app.
 */

import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import {
  Bell,
  CreditCard,
  FileText,
  Heart,
  KeyRound,
  ScrollText,
  ShieldAlert,
  Star,
  Store,
  UserRound,
} from 'lucide-react-native';

import {
  Avatar,
  Badge,
  Button,
  Card,
  LinkRow,
  Screen,
  SectionHeader,
  Sheet,
  SignInPrompt,
} from '@/components/ui';
import { useTheme, useThemeContext } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { listNotifications } from '@/services/api/account';
import { humanize } from '@/utils/format';

export default function ProfileScreen() {
  const t = useTheme();
  const { themeName, preference, setPreference } = useThemeContext();
  const { user, logout } = useSession();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
      <Screen scroll>
        <SignInPrompt
          title="You're not signed in"
          subtitle="Sign in to manage your profile, bookings and notifications."
          next="/(customer)/(tabs)/profile"
        />
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() => router.push('/(auth)/register')}
          fullWidth
        />
      </Screen>
    );
  }

  const onSignOut = async () => {
    setLoggingOut(true);
    try {
      await logout();
      setSignOutOpen(false);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Screen scroll>
      {/* Identity */}
      <View style={styles.header}>
        <Avatar uri={user.avatarUrl} name={user.name} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: t.fgStrong }]} numberOfLines={1}>
            {user.name}
          </Text>
          <Text style={[styles.email, { color: t.muted }]} numberOfLines={1}>
            {user.email}
          </Text>
          <View style={styles.badges}>
            <Badge label={humanize(user.role)} tone="accent" />
            {user.emailVerified ? <Badge label="Verified" tone="success" /> : null}
          </View>
        </View>
      </View>
      <Button
        label="Edit profile"
        variant="secondary"
        onPress={() => router.push('/(customer)/profile/edit')}
        fullWidth
      />

      {/* Account */}
      <View>
        <SectionHeader title="Account" />
        <View style={styles.group}>
          <LinkRow
            label="Edit profile"
            subtitle="Name, phone and photo"
            icon={<UserRound size={20} color={t.muted} />}
            onPress={() => router.push('/(customer)/profile/edit')}
          />
          <LinkRow
            label="Change password"
            icon={<KeyRound size={20} color={t.muted} />}
            onPress={() => router.push('/(customer)/profile/password')}
          />
          <LinkRow
            label="Notifications"
            icon={<Bell size={20} color={t.muted} />}
            badge={unread.data}
            onPress={() => router.push('/(customer)/notifications')}
          />
          <LinkRow
            label="Payments"
            subtitle="Your payment history"
            icon={<CreditCard size={20} color={t.muted} />}
            onPress={() => router.push('/(customer)/payments' as never)}
          />
          <LinkRow
            label="Invoices"
            icon={<FileText size={20} color={t.muted} />}
            onPress={() => router.push('/(customer)/invoices')}
          />
          <LinkRow
            label="Favorites"
            icon={<Heart size={20} color={t.muted} />}
            onPress={() => router.push('/(customer)/favorites')}
          />
          <LinkRow
            label="Reviews"
            icon={<Star size={20} color={t.muted} />}
            onPress={() => router.push('/(customer)/reviews')}
          />
          <LinkRow
            label="Disputes"
            icon={<ShieldAlert size={20} color={t.muted} />}
            onPress={() => router.push('/(customer)/disputes')}
          />
        </View>
      </View>

      {/* Partner upsell — only offered to customers. */}
      {user.role === 'CUSTOMER' ? (
        <Card style={styles.partner}>
          <View style={[styles.partnerIcon, { backgroundColor: t.brandSoft }]}>
            <Store size={20} color={t.brandSoftFg} />
          </View>
          <Text style={[styles.partnerTitle, { color: t.fgStrong }]}>Have space to list?</Text>
          <Text style={{ color: t.muted, lineHeight: 20 }}>
            Switch to a partner account to publish warehouses, equipment and services.
          </Text>
          <Button
            label="Become a partner"
            variant="secondary"
            onPress={() => router.push('/(auth)/register')}
            style={{ marginTop: 10 }}
          />
        </Card>
      ) : null}

      {/* Appearance */}
      <Card>
        <Text style={[styles.cardTitle, { color: t.fgStrong }]}>Appearance</Text>
        <View style={styles.themeRow}>
          <Text style={{ color: t.fg, fontSize: 15 }}>Dark mode</Text>
          <Switch
            value={themeName === 'dark'}
            onValueChange={(v) => setPreference(v ? 'dark' : 'light')}
            trackColor={{ true: t.brand, false: t.line }}
            thumbColor="#fff"
            accessibilityLabel="Toggle dark mode"
          />
        </View>
        <Text style={{ color: t.faint, fontSize: 12 }}>
          Currently: {preference === 'system' ? 'System default' : preference}
        </Text>
      </Card>

      {/* Legal */}
      <View>
        <SectionHeader title="Legal" />
        <View style={styles.group}>
          <LinkRow
            label="Terms of service"
            icon={<ScrollText size={20} color={t.muted} />}
            onPress={() => router.push('/(customer)/terms')}
          />
          <LinkRow
            label="Privacy policy"
            icon={<FileText size={20} color={t.muted} />}
            onPress={() => router.push('/(customer)/privacy')}
          />
        </View>
      </View>

      <Button label="Sign out" variant="danger" onPress={() => setSignOutOpen(true)} fullWidth />

      <Sheet
        visible={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out?"
        subtitle="You'll need to sign in again to see your bookings and messages."
        dismissOnBackdrop={false}
        footer={
          <View style={styles.sheetFooter}>
            <Button label="Cancel" variant="secondary" onPress={() => setSignOutOpen(false)} />
            <Button
              label="Sign out"
              variant="danger"
              onPress={onSignOut}
              loading={loggingOut}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <Text style={{ color: t.muted, lineHeight: 20 }}>
          Any unsaved changes on this screen will be lost. Your data stays safe on your account.
        </Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  name: { fontSize: 20, fontWeight: '800' },
  email: { fontSize: 14, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 8 },
  group: { gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  themeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  partner: { gap: 4 },
  partnerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  partnerTitle: { fontSize: 16, fontWeight: '800' },
  sheetFooter: { flexDirection: 'row', gap: 10 },
});
