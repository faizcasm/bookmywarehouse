/**
 * Partner earnings — settlement KPIs, the paginated earnings ledger and the
 * bank/UPI details used for payouts (stored masked server-side).
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { Landmark } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaginatedList } from '@/components/PaginatedList';
import {
  Badge,
  Banner,
  Button,
  Card,
  KeyValue,
  LinkRow,
  Screen,
  SectionHeader,
  Sheet,
  SignInPrompt,
  Skeleton,
  Stat,
  StatGrid,
  TextField,
} from '@/components/ui';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { getEarnings, getPartnerDashboard, savePayoutDetails } from '@/services/api/partner';
import { formatDate, formatMoney } from '@/utils/format';
import type { Earning, Paginated } from '@/types';

const PAGE_SIZE = 20;

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

interface PayoutForm {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  upiId: string;
}

const EMPTY_PAYOUT: PayoutForm = {
  accountHolderName: '',
  accountNumber: '',
  ifsc: '',
  bankName: '',
  upiId: '',
};

function validatePayout(form: PayoutForm): Partial<Record<keyof PayoutForm, string>> {
  const errors: Partial<Record<keyof PayoutForm, string>> = {};
  if (form.accountHolderName.trim().length < 2) errors.accountHolderName = 'Enter the account holder name';
  if (!/^[0-9]{6,20}$/.test(form.accountNumber.trim())) errors.accountNumber = 'Enter a valid account number';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim().toUpperCase())) errors.ifsc = 'Enter a valid IFSC code';
  if (form.bankName.trim().length < 2) errors.bankName = 'Enter the bank name';
  if (form.upiId.trim() && !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(form.upiId.trim())) {
    errors.upiId = 'Enter a valid UPI ID';
  }
  return errors;
}

export default function PartnerEarningsScreen() {
  const t = useTheme();
  const { user } = useSession();

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payout, setPayout] = useState<PayoutForm>(EMPTY_PAYOUT);
  const [payoutErrors, setPayoutErrors] = useState<Partial<Record<keyof PayoutForm, string>>>({});
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSaved, setPayoutSaved] = useState(false);

  const dashboard = useQuery({
    queryKey: ['partner-dashboard'],
    queryFn: getPartnerDashboard,
    enabled: !!user,
  });
  const summary = useQuery({
    queryKey: ['partner-earnings', 'summary'],
    queryFn: () => getEarnings({ page: 1, limit: 1 }),
    enabled: !!user,
  });

  const fetchPage = useCallback(
    async (page: number): Promise<Paginated<Earning>> => {
      const res = await getEarnings({ page, limit: PAGE_SIZE });
      return {
        items: res.items,
        meta: {
          pagination: {
            page,
            limit: PAGE_SIZE,
            totalItems: res.total,
            totalPages: Math.max(1, Math.ceil(res.total / PAGE_SIZE)),
          },
        },
      };
    },
    [],
  );

  const savePayout = useMutation({
    mutationFn: () =>
      savePayoutDetails({
        accountHolderName: payout.accountHolderName.trim(),
        accountNumber: payout.accountNumber.trim(),
        ifsc: payout.ifsc.trim().toUpperCase(),
        bankName: payout.bankName.trim(),
        upiId: payout.upiId.trim() || null,
      }),
    onSuccess: () => {
      setPayoutSaved(true);
      setPayoutError(null);
    },
    onError: (e) => setPayoutError(errorText(e)),
  });

  if (!user) {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to see your earnings"
          subtitle="Settlements, fees and payout details live here."
          next="/(partner)/(tabs)/earnings"
        />
      </Screen>
    );
  }

  const openPayout = () => {
    setPayout(EMPTY_PAYOUT);
    setPayoutErrors({});
    setPayoutError(null);
    setPayoutSaved(false);
    savePayout.reset();
    setPayoutOpen(true);
  };

  const closePayout = () => {
    setPayoutOpen(false);
    setPayoutError(null);
    setPayoutSaved(false);
  };

  const submitPayout = () => {
    const errors = validatePayout(payout);
    setPayoutErrors(errors);
    if (Object.keys(errors).length) return;
    savePayout.mutate();
  };

  const currency = summary.data?.summary.currency ?? dashboard.data?.currency ?? 'INR';
  const d = dashboard.data;
  const s = summary.data?.summary;

  const header = (
    <View style={styles.headerStack}>
      <Text style={[styles.heading, { color: t.fgStrong }]}>Earnings</Text>

      {summary.isLoading || dashboard.isLoading ? (
        <Skeleton height={104} radius={t.radiusLg} />
      ) : (
        <StatGrid>
          <Stat
            key="earned"
            label="Total earned"
            value={formatMoney(d?.totalEarningsMinor, currency)}
            tone="brand"
            hint="After platform fees"
          />
          <Stat
            key="pending"
            label="Pending payout"
            value={formatMoney(d?.pendingPayoutMinor, currency)}
            hint="Next settlement"
          />
          <Stat
            key="last30"
            label="Last 30 days"
            value={formatMoney(d?.last30DaysMinor, currency)}
            hint="Booked value"
          />
          <Stat
            key="gross"
            label="Gross billed"
            value={formatMoney(s?.gross, currency)}
            hint={`Fees ${formatMoney(s?.fees, currency)}`}
          />
        </StatGrid>
      )}

      <SectionHeader title="Payout details" />
      <LinkRow
        label="Bank or UPI for settlements"
        subtitle="Account numbers are stored masked"
        icon={<Landmark size={20} color={t.muted} />}
        onPress={openPayout}
      />
      <Text style={{ color: t.faint, fontSize: 12.5, lineHeight: 18 }}>
        Set the account used for payouts. Re-enter the details any time to update them — the
        account number is never shown again after saving.
      </Text>

      <SectionHeader title="Settlements" />
    </View>
  );

  return (
    <Screen style={styles.screen}>
      <PaginatedList<Earning>
        queryKey={['partner-earnings']}
        fetchPage={fetchPage}
        keyExtractor={(e) => e.id}
        itemHeight={168}
        header={header}
        emptyTitle="No earnings yet"
        emptySubtitle="Earnings appear here once a booking is paid for."
        renderItem={(e) => {
          const paid = Boolean(e.paidAt);
          return (
            <Card style={styles.row}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.rowTitle, { color: t.fgStrong }]} numberOfLines={1}>
                    {e.listingTitle ?? e.bookingReference ?? 'Booking'}
                  </Text>
                  {e.bookingReference ? (
                    <Text style={{ color: t.muted, fontSize: 12.5 }}>Ref {e.bookingReference}</Text>
                  ) : null}
                </View>
                <Badge label={paid ? 'Paid' : 'Pending'} tone={paid ? 'success' : 'warn'} />
              </View>
              <KeyValue
                layout="row"
                items={[
                  { label: 'Gross', value: formatMoney(e.grossAmount, e.currency) },
                  { label: 'Platform fee', value: `− ${formatMoney(e.platformFee, e.currency)}` },
                  { label: 'You receive', value: formatMoney(e.netAmount, e.currency) },
                  {
                    label: paid ? 'Paid on' : 'Status',
                    value: paid ? formatDate(e.paidAt) : 'Awaiting settlement',
                  },
                ]}
              />
            </Card>
          );
        }}
      />

      <Sheet
        visible={payoutOpen}
        onClose={closePayout}
        title="Payout details"
        subtitle="Where your earnings are settled"
        dismissOnBackdrop={!savePayout.isPending}
        footer={
          payoutSaved ? (
            <Button label="Done" onPress={closePayout} fullWidth />
          ) : (
            <Button
              label="Save payout details"
              onPress={submitPayout}
              loading={savePayout.isPending}
              fullWidth
            />
          )
        }
      >
        {payoutSaved ? (
          <Banner
            tone="success"
            title="Payout details saved"
            message="Future settlements will use these details."
          />
        ) : (
          <>
            {payoutError ? <Banner tone="danger" message={payoutError} /> : null}
            <TextField
              label="Account holder name"
              value={payout.accountHolderName}
              onChangeText={(v) => setPayout((f) => ({ ...f, accountHolderName: v }))}
              error={payoutErrors.accountHolderName}
              autoCapitalize="words"
            />
            <TextField
              label="Account number"
              value={payout.accountNumber}
              onChangeText={(v) => setPayout((f) => ({ ...f, accountNumber: v }))}
              error={payoutErrors.accountNumber}
              keyboardType="number-pad"
              hint="Stored masked — only the last 4 digits are ever kept."
            />
            <TextField
              label="IFSC"
              value={payout.ifsc}
              onChangeText={(v) => setPayout((f) => ({ ...f, ifsc: v.toUpperCase() }))}
              error={payoutErrors.ifsc}
              autoCapitalize="characters"
              placeholder="HDFC0000123"
            />
            <TextField
              label="Bank name"
              value={payout.bankName}
              onChangeText={(v) => setPayout((f) => ({ ...f, bankName: v }))}
              error={payoutErrors.bankName}
            />
            <TextField
              label="UPI ID (optional)"
              value={payout.upiId}
              onChangeText={(v) => setPayout((f) => ({ ...f, upiId: v }))}
              error={payoutErrors.upiId}
              autoCapitalize="none"
              placeholder="name@bank"
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, flex: 1, gap: 12 },
  headerStack: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  heading: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  row: { gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowTitle: { fontSize: 15.5, fontWeight: '700' },
});
