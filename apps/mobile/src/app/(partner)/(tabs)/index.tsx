/**
 * Partner dashboard — the command centre: KPIs, revenue trend, response rate,
 * verification prompt, upcoming bookings and the requests that need a decision.
 */

import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Banner,
  Button,
  Card,
  ChartCard,
  ColumnChart,
  ErrorState,
  RatioBar,
  Screen,
  SectionHeader,
  Sheet,
  SignInPrompt,
  Skeleton,
  Sparkline,
  Stat,
  StatGrid,
  TextField,
} from '@/components/ui';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import {
  confirmBooking,
  getPartnerDashboard,
  getPartnerProfile,
  getVerificationState,
  rejectPartnerBooking,
} from '@/services/api/partner';
import {
  BOOKING_STATUS_META,
  VERIFICATION_STATUS_META,
  formatDayLabel,
  formatDayRange,
  formatMoneyCompact,
} from '@/utils/format';
import type { Booking, VerificationStatus } from '@/types';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

/** Accept is offered for every state where confirming moves the booking on. */
const canAccept = (b: Booking) =>
  (b.availableActions ?? []).some((a) => a === 'CONFIRMED' || a === 'AWAITING_PAYMENT');
const canReject = (b: Booking) => (b.availableActions ?? []).includes('REJECTED');

export default function PartnerDashboardScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const qc = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [rejecting, setRejecting] = useState<Booking | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dashboard = useQuery({
    queryKey: ['partner-dashboard'],
    queryFn: getPartnerDashboard,
    enabled: !!user,
  });
  const profile = useQuery({
    queryKey: ['partner-profile'],
    queryFn: getPartnerProfile,
    enabled: !!user,
  });
  const verification = useQuery({
    queryKey: ['verification'],
    queryFn: getVerificationState,
    enabled: !!user,
  });

  const { refetch: refetchDashboard } = dashboard;
  const { refetch: refetchProfile } = profile;
  const { refetch: refetchVerification } = verification;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchDashboard(), refetchProfile(), refetchVerification()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchDashboard, refetchProfile, refetchVerification]);

  const invalidateBookings = () => {
    qc.invalidateQueries({ queryKey: ['partner-bookings'] });
    qc.invalidateQueries({ queryKey: ['partner-booking'] });
  };

  const accept = useMutation({
    mutationFn: (id: string) => confirmBooking(id),
    onSuccess: () => {
      setNotice('Request accepted — the customer has been notified.');
      invalidateBookings();
      qc.invalidateQueries({ queryKey: ['partner-dashboard'] });
    },
    onError: (e) => setActionError(errorText(e)),
  });

  const reject = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => rejectPartnerBooking(vars.id, vars.reason),
    onSuccess: () => {
      setRejecting(null);
      setReason('');
      setActionError(null);
      setNotice('Request declined — the customer has been notified.');
      invalidateBookings();
      qc.invalidateQueries({ queryKey: ['partner-dashboard'] });
    },
    onError: (e) => setActionError(errorText(e)),
  });

  const closeReject = () => {
    setRejecting(null);
    setReason('');
    setActionError(null);
    if (reject.isPending) reject.reset();
  };

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to your partner console"
          subtitle="Your listings, bookings and earnings live here."
          next="/(partner)/(tabs)"
        />
      </Screen>
    );
  }

  if (dashboard.isLoading) {
    return (
      <Screen scroll>
        <Skeleton height={44} radius={12} />
        <View style={styles.gridSkeleton}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={92} radius={t.radiusLg} style={styles.gridItem} />
          ))}
        </View>
        <Skeleton height={180} radius={t.radiusLg} />
        <Skeleton height={120} radius={t.radiusLg} />
      </Screen>
    );
  }

  if (dashboard.isError) {
    return (
      <Screen>
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      </Screen>
    );
  }

  const d = dashboard.data ?? {};
  const currency = d.currency ?? 'INR';
  const trends = d.trends ?? [];
  const revenueSeries = trends.slice(-7).map((p) => ({
    label: formatDayLabel(p.date),
    value: p.revenue,
    display: formatMoneyCompact(p.revenue, currency),
  }));
  const bookingSeries = trends.map((p) => p.bookings);
  const bookedTotal = bookingSeries.reduce((sum, n) => sum + n, 0);

  const status = (verification.data?.status ??
    d.verificationStatus ??
    'DRAFT') as VerificationStatus;
  const verificationMeta = VERIFICATION_STATUS_META[status];
  const rejectionReason = verification.data?.rejectionReason;

  const upcoming = d.upcomingBookings ?? [];
  const recent = d.recentBookings ?? [];
  const responseRate = d.responseRate ?? 0;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: t.bgPage }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 24) },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.brand} colors={[t.brand]} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.heading, { color: t.fgStrong }]} numberOfLines={1}>
            {profile.data?.businessName || user.name}
          </Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>Partner console</Text>
        </View>
        <Badge label={verificationMeta?.label ?? status} tone={verificationMeta?.tone ?? 'neutral'} />
      </View>

      {notice ? (
        <Banner tone="success" message={notice} actionLabel="Dismiss" onAction={() => setNotice(null)} />
      ) : null}

      {status === 'VERIFIED' ? null : status === 'REJECTED' ? (
        <Banner
          tone="danger"
          title="Verification rejected"
          message={
            rejectionReason
              ? `Reason: ${rejectionReason}. Update your documents and resubmit.`
              : 'Update your documents and resubmit them for review.'
          }
          actionLabel="Review submission"
          onAction={() => router.push('/(partner)/verification')}
        />
      ) : status === 'DRAFT' ? (
        <Banner
          tone="warn"
          title="Verify your business"
          message="Complete verification to publish listings and accept booking requests."
          actionLabel="Start verification"
          onAction={() => router.push('/(partner)/verification')}
        />
      ) : (
        <Banner
          tone="info"
          title="Verification under review"
          message="Your documents are being reviewed. You will be notified as soon as a decision is made."
          actionLabel="View status"
          onAction={() => router.push('/(partner)/verification')}
        />
      )}

      <StatGrid>
        <Stat
          key="active"
          label="Active listings"
          value={d.activeListings ?? 0}
          tone="brand"
          hint={`${d.draftListings ?? 0} in draft`}
          onPress={() => router.push('/(partner)/(tabs)/listings')}
        />
        <Stat
          key="pending"
          label="Pending requests"
          value={d.pendingBookings ?? 0}
          tone={(d.pendingBookings ?? 0) > 0 ? 'warn' : 'neutral'}
          onPress={() => router.push('/(partner)/(tabs)/bookings')}
        />
        <Stat
          key="confirmed"
          label="Confirmed"
          value={d.confirmedBookings ?? 0}
          onPress={() => router.push('/(partner)/(tabs)/bookings')}
        />
        <Stat
          key="completed"
          label="Completed"
          value={d.completedBookings ?? 0}
          onPress={() => router.push('/(partner)/(tabs)/bookings')}
        />
        <Stat
          key="revenue"
          label="Revenue (30 days)"
          value={formatMoneyCompact(d.last30DaysMinor, currency)}
          hint="Booked value"
          onPress={() => router.push('/(partner)/(tabs)/earnings')}
        />
        <Stat
          key="messages"
          label="Unread messages"
          value={d.unreadMessages ?? 0}
          tone={(d.unreadMessages ?? 0) > 0 ? 'brand' : 'neutral'}
          onPress={() => router.push('/(partner)/(tabs)/messages')}
        />
      </StatGrid>

      {revenueSeries.length ? (
        <ChartCard
          title="Revenue trend"
          subtitle={`Booked value per day · last ${revenueSeries.length} days`}
        >
          <ColumnChart data={revenueSeries} height={128} />
          <Sparkline values={bookingSeries} caption={`${bookedTotal} bookings in the last ${trends.length} days`} />
        </ChartCard>
      ) : (
        <Card>
          <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 20 }}>
            The revenue trend appears once bookings start coming in.
          </Text>
        </Card>
      )}

      <Card>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Response rate</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>
              {responseRate}% of requests answered
              {typeof d.ratingAvg === 'number' && d.ratingAvg > 0
                ? ` · ${d.ratingAvg.toFixed(1)}★ from ${d.reviewCount ?? 0} reviews`
                : ''}
            </Text>
          </View>
        </View>
        <RatioBar ratio={responseRate / 100} label={`${responseRate}% answered`} />
        <Button
          label="Read reviews"
          variant="ghost"
          onPress={() => router.push('/(partner)/reviews')}
          style={styles.alignStart}
        />
      </Card>

      <SectionHeader
        title="Upcoming bookings"
        actionLabel={upcoming.length ? 'View all' : undefined}
        onAction={() => router.push('/(partner)/(tabs)/bookings')}
      />
      {upcoming.length ? (
        <View style={styles.stack}>
          {upcoming.map((b) => {
            const meta = BOOKING_STATUS_META[b.status];
            return (
              <Card key={b.id} onPress={() => router.push(`/(partner)/booking/${b.id}` as never)}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {b.listingTitle ?? 'Booking'}
                    </Text>
                    <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
                      {b.customerName ?? 'Customer'}
                    </Text>
                    <Text style={{ color: t.muted, fontSize: 13 }}>
                      {formatDayRange(b.startDate, b.endDate)}
                    </Text>
                  </View>
                  <Badge label={meta?.label ?? b.status} tone={meta?.tone ?? 'neutral'} />
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <Card>
          <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 20 }}>
            No upcoming bookings. Confirmed requests show up here with their dates.
          </Text>
        </Card>
      )}

      <SectionHeader
        title="Recent requests"
        actionLabel={recent.length ? 'View all' : undefined}
        onAction={() => router.push('/(partner)/(tabs)/bookings')}
      />
      {recent.length ? (
        <View style={styles.stack}>
          {recent.map((b) => {
            const meta = BOOKING_STATUS_META[b.status];
            const acceptAllowed = canAccept(b);
            const rejectAllowed = canReject(b);
            return (
              <Card key={b.id}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {b.listingTitle ?? 'Booking'}
                    </Text>
                    <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
                      {b.customerName ?? 'Customer'}
                    </Text>
                    <Text style={{ color: t.muted, fontSize: 13 }}>
                      {formatDayRange(b.startDate, b.endDate)}
                    </Text>
                  </View>
                  <Badge label={meta?.label ?? b.status} tone={meta?.tone ?? 'neutral'} />
                </View>
                <Button
                  label="View request"
                  variant="ghost"
                  onPress={() => router.push(`/(partner)/booking/${b.id}` as never)}
                  style={styles.alignStart}
                />
                {acceptAllowed || rejectAllowed ? (
                  <View style={styles.actionRow}>
                    {acceptAllowed ? (
                      <Button
                        label="Accept"
                        style={styles.flex}
                        onPress={() => accept.mutate(b.id)}
                        loading={accept.isPending && accept.variables === b.id}
                      />
                    ) : null}
                    {rejectAllowed ? (
                      <Button
                        label="Decline"
                        variant="secondary"
                        style={styles.flex}
                        onPress={() => {
                          setActionError(null);
                          setReason('');
                          setRejecting(b);
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      ) : (
        <Card>
          <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 20 }}>
            No new requests. Published listings that receive requests appear here.
          </Text>
        </Card>
      )}

      <Sheet
        visible={!!rejecting}
        onClose={closeReject}
        title="Decline request"
        subtitle={
          rejecting
            ? `${rejecting.listingTitle ?? 'Booking'} · ${rejecting.customerName ?? 'Customer'}`
            : undefined
        }
        dismissOnBackdrop={false}
        footer={
          <Button
            label="Decline request"
            variant="danger"
            fullWidth
            loading={reject.isPending}
            disabled={reason.trim().length < 3}
            onPress={() =>
              rejecting ? reject.mutate({ id: rejecting.id, reason: reason.trim() }) : undefined
            }
          />
        }
      >
        {actionError ? <Banner tone="danger" message={actionError} /> : null}
        <TextField
          label="Reason for declining"
          value={reason}
          onChangeText={setReason}
          multiline
          hint="Shared with the customer. At least 3 characters."
          placeholder="Fully booked, dates unavailable…"
        />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  heading: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  gridSkeleton: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '50%', margin: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowTitle: { fontSize: 15.5, fontWeight: '700' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  stack: { gap: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  flex: { flex: 1 },
  alignStart: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
