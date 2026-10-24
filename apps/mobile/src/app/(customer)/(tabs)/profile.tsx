/** Profile tab — account info, quick links, theme toggle, sign out. */

import { router } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { Badge, Button, Card, EmptyState, Screen } from '@/components/ui';
import { useTheme, useThemeContext } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { humanize } from '@/utils/format';

export default function ProfileScreen() {
  const t = useTheme();
  const { themeName, preference, setPreference } = useThemeContext();
  const { user, status, logout } = useSession();

  const confirmLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  if (status !== 'authenticated' || !user) {
    return (
      <Screen>
        <EmptyState
          title="You're not signed in"
          subtitle="Sign in to manage your profile, bookings and notifications."
          actionLabel="Sign in"
          onAction={() => router.push('/(auth)/login')}
        />
        <Button label="Create an account" variant="secondary" onPress={() => router.push('/(auth)/register')} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: t.brandSoft }]}>
          <Text style={{ color: t.brandSoftFg, fontSize: 24, fontWeight: '700' }}>
            {user.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: t.fgStrong }]}>{user.fullName}</Text>
          <Text style={{ color: t.muted }}>{user.email}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            <Badge label={humanize(user.role)} tone="accent" />
            {user.emailVerified ? <Badge label="Verified" tone="success" /> : null}
          </View>
        </View>
      </View>

      <Card>
        <Text style={[styles.cardTitle, { color: t.fgStrong }]}>Account</Text>
        <LinkRow label="Edit profile" onPress={() => router.push('/(customer)/profile/edit')} />
        <LinkRow label="Favorites" onPress={() => router.push('/(customer)/favorites')} />
        <LinkRow label="Reviews" onPress={() => router.push('/(customer)/reviews')} />
        <LinkRow label="Invoices" onPress={() => router.push('/(customer)/invoices')} />
        <LinkRow label="Notifications" onPress={() => router.push('/(customer)/notifications')} />
        <LinkRow label="Disputes" onPress={() => router.push('/(customer)/disputes')} />
        <LinkRow label="Change password" onPress={() => router.push('/(customer)/profile/password')} last />
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: t.fgStrong }]}>Appearance</Text>
        <View style={styles.themeRow}>
          <Text style={{ color: t.fg, fontSize: 15 }}>Dark mode</Text>
          <Switch
            value={themeName === 'dark'}
            onValueChange={(v) => setPreference(v ? 'dark' : 'light')}
            trackColor={{ true: t.brand, false: t.line }}
            thumbColor="#fff"
          />
        </View>
        <Text style={{ color: t.faint, fontSize: 12 }}>
          Currently: {preference === 'system' ? 'System default' : preference}
        </Text>
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: t.fgStrong }]}>Legal</Text>
        <LinkRow label="Terms of service" onPress={() => router.push('/(customer)/terms')} />
        <LinkRow label="Privacy policy" onPress={() => router.push('/(customer)/privacy')} last />
      </Card>

      <Button label="Sign out" variant="danger" onPress={confirmLogout} fullWidth />
    </Screen>
  );
}

function LinkRow({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  const t = useTheme();
  return (
    <View>
      <Text onPress={onPress} style={[styles.linkRow, { color: t.fg, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 20, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  linkRow: { fontSize: 15, paddingVertical: 14, borderBottomWidth: 1 },
  themeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
});