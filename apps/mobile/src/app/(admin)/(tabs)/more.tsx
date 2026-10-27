/**
 * Admin "More" — the full console menu (every non-tab screen), the signed-in
 * administrator's profile, and sign-out behind a confirmation sheet.
 */

import { router } from 'expo-router';
import {
  Building2,
  CreditCard,
  FileDown,
  Receipt,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  Star,
  Tags,
  Users,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  LinkRow,
  Screen,
  SectionHeader,
  Sheet,
  SignInPrompt,
} from '@/components/ui';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { humanize } from '@/utils/format';

export default function AdminMoreScreen() {
  const t = useTheme();
  const { user, logout } = useSession();

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const confirmSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await logout();
      setSignOutOpen(false);
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Could not sign out. Try again.');
    } finally {
      setSigningOut(false);
    }
  };

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to the admin console"
          subtitle="Manage the marketplace once you are signed in as an administrator."
          next="/(admin)/(tabs)/more"
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar uri={user.avatarUrl} name={user.name} size={64} />
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: t.fgStrong }]} numberOfLines={1}>
            {user.name}
          </Text>
          <Text style={[styles.email, { color: t.muted }]} numberOfLines={1}>
            {user.email}
          </Text>
          <View style={styles.roleRow}>
            <Badge label={humanize(user.role)} tone="accent" />
          </View>
        </View>
      </View>

      <SectionHeader title="Operations" />
      <Card padded={false}>
        <LinkRow
          label="Users"
          subtitle="Accounts, suspension and creation"
          icon={<Users size={20} color={t.brand} />}
          onPress={() => router.push('/(admin)/(tabs)/users' as never)}
        />
        <LinkRow
          label="Partner directory"
          subtitle="Businesses, KYC status and decisions"
          icon={<Building2 size={20} color={t.brand} />}
          onPress={() => router.push('/(admin)/partners' as never)}
        />
        <LinkRow
          label="Verifications"
          subtitle="Pending KYC submissions"
          icon={<ShieldCheck size={20} color={t.brand} />}
          onPress={() => router.push('/(admin)/verifications' as never)}
        />
        <LinkRow
          label="Payments & refunds"
          subtitle="Captures, failures and refund queue"
          icon={<CreditCard size={20} color={t.brand} />}
          onPress={() => router.push('/(admin)/payments' as never)}
        />
        <LinkRow
          label="Invoices"
          subtitle="Issued invoices and totals"
          icon={<Receipt size={20} color={t.brand} />}
          onPress={() => router.push('/(admin)/invoices' as never)}
        />
        <LinkRow
          label="Disputes"
          subtitle="Resolve customer cases"
          icon={<Scale size={20} color={t.brand} />}
          onPress={() => router.push('/(admin)/disputes' as never)}
        />
        <LinkRow
          label="Categories"
          subtitle="Taxonomy and listing counts"
          icon={<Tags size={20} color={t.brand} />}
          onPress={() => router.push('/(admin)/categories' as never)}
        />
        <LinkRow
          label="Reviews"
          subtitle="Moderate public reviews"
          icon={<Star size={20} color={t.brand} />}
          onPress={() => router.push('/(admin)/reviews' as never)}
        />
      </Card>

      <SectionHeader title="Platform" />
      <Card padded={false}>
        <LinkRow
          label="Settings"
          subtitle="Fees, payouts, maintenance"
          icon={<Settings size={20} color={t.brand} />}
          onPress={() => router.push('/(admin)/settings' as never)}
        />
        <LinkRow
          label="Audit log"
          subtitle="Every admin action, recorded"
          icon={<ScrollText size={20} color={t.brand} />}
          onPress={() => router.push('/(admin)/audit' as never)}
        />
        <LinkRow
          label="Export data"
          subtitle="Download CSV exports"
          icon={<FileDown size={20} color={t.brand} />}
          onPress={() => router.push('/(admin)/exports' as never)}
        />
      </Card>

      <Button
        label="Sign out"
        variant="danger"
        fullWidth
        style={styles.signOut}
        onPress={() => setSignOutOpen(true)}
      />

      <Sheet
        visible={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out"
        subtitle="You will need to sign in again to access the console."
        dismissOnBackdrop={false}
        footer={
          <Button
            label="Sign out"
            variant="danger"
            fullWidth
            loading={signingOut}
            onPress={() => void confirmSignOut()}
          />
        }
      >
        <Text style={[styles.signOutNote, { color: t.muted }]}>
          Any in-progress moderation is unaffected — drafts stay on the server.
        </Text>
        {signOutError ? <Banner tone="danger" message={signOutError} /> : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  headerText: { flex: 1, gap: 2 },
  name: { fontSize: 20, fontWeight: '800' },
  email: { fontSize: 14 },
  roleRow: { flexDirection: 'row', marginTop: 4 },
  signOut: { marginTop: 8 },
  signOutNote: { fontSize: 14, lineHeight: 20 },
});
