/**
 * Admin partner directory — searchable list of every business on the platform
 * with verification status, listing counts and bookings.
 */

import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { PaginatedList } from '@/components/PaginatedList';
import { Badge, Card, Screen, SignInPrompt, TextField } from '@/components/ui';
import { listAdminPartners, type AdminPartnerRow } from '@/services/api/admin';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { VERIFICATION_STATUS_META, humanize } from '@/utils/format';

export default function AdminPartnersScreen() {
  const t = useTheme();
  const { user } = useSession();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(value.trim()), 300);
  };

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to browse partners"
          subtitle="The partner directory is available to platform administrators."
          next="/(admin)/partners"
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, { backgroundColor: t.surface2 }, pressed && { opacity: 0.7 }]}
        >
          <ChevronLeft size={22} color={t.fg} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.heading, { color: t.fgStrong }]}>Partners</Text>
          <Text style={[styles.subheading, { color: t.muted }]}>
            Every business selling on the marketplace.
          </Text>
        </View>
      </View>

      <PaginatedList<AdminPartnerRow>
        queryKey={['admin-partners', search]}
        fetchPage={(page) => listAdminPartners({ page, limit: 20, q: search || undefined })}
        keyExtractor={(p) => p.partnerId}
        emptyTitle="No partners found"
        emptySubtitle="Try a different search term."
        itemHeight={132}
        header={
          <View style={styles.searchWrap}>
            <TextField
              label="Search partners"
              value={searchInput}
              onChangeText={onSearchChange}
              placeholder="Business name"
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>
        }
        renderItem={(p) => {
          const meta = VERIFICATION_STATUS_META[p.verificationStatus as keyof typeof VERIFICATION_STATUS_META];
          const listings = p.listingCount ?? 0;
          const bookings = p.totalBookings ?? 0;
          return (
            <Card
              style={styles.rowCard}
              onPress={() => router.push(`/(admin)/partners/${p.partnerId}` as never)}
            >
              <View style={styles.rowTop}>
                <View style={styles.rowTitleWrap}>
                  <Text style={[styles.name, { color: t.fgStrong }]} numberOfLines={1}>
                    {p.businessName || p.user?.name || 'Partner'}
                  </Text>
                  <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
                    {[p.user?.email, p.city].filter(Boolean).join(' · ') || humanize(p.businessType ?? 'Partner')}
                  </Text>
                  <Text style={[styles.meta, { color: t.faint }]}>
                    {listings} listing{listings === 1 ? '' : 's'} · {bookings} booking
                    {bookings === 1 ? '' : 's'}
                  </Text>
                </View>
                <Badge
                  label={meta?.label ?? humanize(p.verificationStatus)}
                  tone={meta?.tone ?? 'neutral'}
                />
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  heading: { fontSize: 24, fontWeight: '800' },
  subheading: { fontSize: 13, marginTop: 2 },
  searchWrap: { gap: 12 },
  rowCard: { gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitleWrap: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
});
