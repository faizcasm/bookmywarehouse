/** Partner "More" — earnings, verification, profile, sign out. */

import { router } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Screen } from '@/components/ui';
import { useTheme } from '@/store/ThemeContext';
import { useSession } from '@/store/SessionContext';
import { humanize } from '@/utils/format';

function LinkRow({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  const t = useTheme();
  return (
    <Text
      onPress={onPress}
      style={[styles.linkRow, { color: t.fg, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }]}
    >
      {label}
    </Text>
  );
}

export default function PartnerMoreScreen() {
  const t = useTheme();
  const { user, logout } = useSession();

  const confirmLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: t.brandSoft }]}>
          <Text style={{ color: t.brandSoftFg, fontSize: 24, fontWeight: '700' }}>
            {user?.name?.charAt(0)?.toUpperCase() ?? 'P'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: t.fgStrong }]}>{user?.name}</Text>
          <Text style={{ color: t.muted }}>{user?.email}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            <Badge label={humanize(user?.role ?? 'PARTNER')} tone="accent" />
          </View>
        </View>
      </View>

      <Card>
        <Text style={[styles.cardTitle, { color: t.fgStrong }]}>Business</Text>
        <LinkRow label="Earnings & payouts" onPress={() => router.push('/(partner)/earnings')} />
        <LinkRow label="Verification" onPress={() => router.push('/(partner)/verification')} />
        <LinkRow label="Business profile" onPress={() => router.push('/(partner)/profile')} last />
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

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 20, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  linkRow: { fontSize: 15, paddingVertical: 14, borderBottomWidth: 1 },
});
