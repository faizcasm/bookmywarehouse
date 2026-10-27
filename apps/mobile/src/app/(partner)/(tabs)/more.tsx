/**
 * Partner "More" — the account hub: profile, verification, earnings, reviews,
 * notifications, messages, legal pages and sign out.
 */

import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Building2,
  CalendarRange,
  FileText,
  MessageSquare,
  ShieldCheck,
  Star,
  Wallet,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, Badge, Button, LinkRow, Screen, SectionHeader, Sheet } from '@/components/ui';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { getPartnerDashboard, getPartnerProfile } from '@/services/api/partner';
import { VERIFICATION_STATUS_META, humanize } from '@/utils/format';

export default function PartnerMoreScreen() {
  const t = useTheme();
  const { user, logout } = useSession();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const profile = useQuery({
    queryKey: ['partner-profile'],
    queryFn: getPartnerProfile,
    enabled: !!user,
  });
  const dashboard = useQuery({
    queryKey: ['partner-dashboard'],
    queryFn: getPartnerDashboard,
    enabled: !!user,
  });

  const verificationStatus = profile.data?.verificationStatus;
  const verificationMeta = verificationStatus ? VERIFICATION_STATUS_META[verificationStatus] : undefined;
  const unreadMessages = dashboard.data?.unreadMessages ?? 0;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar uri={user?.avatarUrl} name={user?.name} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: t.fgStrong }]} numberOfLines={1}>
            {profile.data?.businessName || user?.name}
          </Text>
          <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
            {user?.email}
          </Text>
          <View style={styles.badges}>
            <Badge label={humanize(user?.role ?? 'PARTNER')} tone="accent" />
            {verificationMeta ? (
              <Badge label={verificationMeta.label} tone={verificationMeta.tone} />
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.group}>
        <SectionHeader title="Business" />
        <LinkRow
          label="Business profile"
          subtitle={profile.data?.businessName ? undefined : 'Set up your business details'}
          icon={<Building2 size={20} color={t.muted} />}
          onPress={() => router.push('/(partner)/profile')}
        />
        <LinkRow
          label="Verification"
          value={verificationMeta?.label}
          icon={<ShieldCheck size={20} color={t.muted} />}
          onPress={() => router.push('/(partner)/verification')}
        />
        <LinkRow
          label="Earnings & payouts"
          icon={<Wallet size={20} color={t.muted} />}
          onPress={() => router.push('/(partner)/(tabs)/earnings')}
        />
        <LinkRow
          label="Availability"
          subtitle="Weekly rules and blocked dates"
          icon={<CalendarRange size={20} color={t.muted} />}
          onPress={() => router.push('/(partner)/availability')}
        />
        <LinkRow
          label="Reviews"
          icon={<Star size={20} color={t.muted} />}
          onPress={() => router.push('/(partner)/reviews')}
        />
      </View>

      <View style={styles.group}>
        <SectionHeader title="Account" />
        <LinkRow
          label="Notifications"
          icon={<Bell size={20} color={t.muted} />}
          onPress={() => router.push('/(partner)/notifications')}
        />
        <LinkRow
          label="Messages"
          badge={unreadMessages}
          icon={<MessageSquare size={20} color={t.muted} />}
          onPress={() => router.push('/(partner)/(tabs)/messages')}
        />
      </View>

      <View style={styles.group}>
        <SectionHeader title="Legal" />
        <LinkRow
          label="Terms of service"
          icon={<FileText size={20} color={t.muted} />}
          onPress={() => router.push('/(customer)/terms')}
        />
        <LinkRow
          label="Privacy policy"
          icon={<FileText size={20} color={t.muted} />}
          onPress={() => router.push('/(customer)/privacy')}
        />
      </View>

      <Button label="Sign out" variant="danger" fullWidth onPress={() => setSignOutOpen(true)} />

      <Sheet
        visible={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out?"
        subtitle="You will need to sign in again to manage your listings."
        dismissOnBackdrop
        footer={
          <View style={styles.footerRow}>
            <Button
              label="Stay signed in"
              variant="secondary"
              style={styles.flex}
              onPress={() => setSignOutOpen(false)}
            />
            <Button label="Sign out" variant="danger" style={styles.flex} onPress={() => void logout()} />
          </View>
        }
      >
        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>
          Your data stays on your account — nothing is removed when you sign out.
        </Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  name: { fontSize: 20, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  group: { gap: 8 },
  footerRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
