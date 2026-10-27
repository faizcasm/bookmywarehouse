/** Checkout — initiate a payment, drive the sandbox simulator or hosted checkout. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  ErrorState,
  KeyValue,
  LoadingOverlay,
  Screen,
  SectionHeader,
  SignInPrompt,
} from '@/components/ui';
import { getBooking } from '@/services/api/bookings';
import { getPaymentConfig, initiatePayment, simulatePayment } from '@/services/api/payments';
import { useSession } from '@/store/SessionContext';
import { useTheme } from '@/store/ThemeContext';
import { BOOKING_STATUS_META, formatDayRange, formatMoney } from '@/utils/format';

const PAID_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
const POLL_MS = 8000;
const WEBHOOK_ATTEMPTS = 5;

function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function PayBookingScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { status: sessionStatus } = useSession();

  const enabled = !!bookingId && sessionStatus === 'authenticated';
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'success' | 'failure' | null>(null);
  const [browserError, setBrowserError] = useState<string | null>(null);

  // Poll while a hosted checkout is open and the booking still needs payment.
  const booking = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => getBooking(bookingId!),
    enabled,
    refetchInterval: (query) => {
      const current = query.state.data?.status;
      return checkoutOpened && current && !PAID_STATUSES.includes(current) ? POLL_MS : false;
    },
  });
  const b = booking.data ?? null;

  const config = useQuery({ queryKey: ['payment-config'], queryFn: getPaymentConfig, enabled });

  const sandbox = config.data?.sandbox ?? true;

  const initiate = useMutation({
    mutationFn: () => initiatePayment(bookingId!),
    onSuccess: async (result) => {
      setPaymentId(result.paymentId || null);
      if (result.sandbox || result.provider === 'SANDBOX') {
        if (!result.paymentId) {
          setBrowserError('No payment session was created for this booking. Go back and try again.');
        }
        return;
      }
      if (result.checkoutUrl) {
        setBrowserError(null);
        setCheckoutOpened(true);
        try {
          await WebBrowser.openBrowserAsync(result.checkoutUrl);
        } catch {
          setBrowserError('The checkout page could not be opened. Try again.');
        }
        await booking.refetch();
      } else {
        setBrowserError(
          `${result.provider} did not return a checkout link. Go back and try again, or contact support if it keeps happening.`,
        );
      }
    },
  });

  const simulate = useMutation({
    mutationFn: (vars: { outcome: 'SUCCESS' | 'FAILURE' }) =>
      simulatePayment(paymentId!, vars.outcome),
    onSuccess: async (_res, vars) => {
      setOutcome(vars.outcome === 'SUCCESS' ? 'success' : 'failure');
      if (vars.outcome === 'SUCCESS') {
        qc.invalidateQueries({ queryKey: ['bookings'] });
        // The sandbox webhook processes the event asynchronously — poll briefly
        // so the confirmation panel appears as soon as the booking flips.
        for (let attempt = 0; attempt < WEBHOOK_ATTEMPTS; attempt += 1) {
          const res = await booking.refetch();
          if (res.data && PAID_STATUSES.includes(res.data.status)) break;
          await wait(800);
        }
      }
    },
  });

  if (sessionStatus !== 'authenticated') {
    return (
      <Screen>
        <SignInPrompt
          title="Sign in to pay"
          subtitle="Payments are tied to your account and booking."
          next={`/(customer)/pay/${bookingId}`}
        />
      </Screen>
    );
  }
  if (booking.isLoading || config.isLoading) {
    return (
      <Screen>
        <LoadingOverlay />
      </Screen>
    );
  }
  if (booking.isError || !b) {
    return (
      <Screen>
        <ErrorState error={booking.error} onRetry={() => booking.refetch()} />
      </Screen>
    );
  }

  const statusMeta = BOOKING_STATUS_META[b.status];
  const paid = PAID_STATUSES.includes(b.status);
  const awaitingPayment = b.status === 'AWAITING_PAYMENT';
  const canStart = awaitingPayment && !paid;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.fgStrong }]}>Checkout</Text>
        <Text style={{ color: t.muted }}>{b.listingTitle ?? 'Booking payment'}</Text>
      </View>

      <Card>
        <KeyValue
          items={[
            ...(b.reference ? [{ label: 'Reference', value: b.reference }] : []),
            { label: 'Status', value: statusMeta?.label ?? b.status },
            { label: 'Dates', value: formatDayRange(b.startDate, b.endDate) },
            { label: 'Amount due', value: formatMoney(b.totalMinor, b.currency) },
          ]}
        />
      </Card>

      {paid ? (
        <>
          <Banner
            tone="success"
            title="Payment received"
            message={`Your booking${b.reference ? ` ${b.reference}` : ''} is confirmed. A copy of the invoice is available in your invoices.`}
          />
          <Button
            label="View invoice"
            fullWidth
            onPress={() => router.push('/(customer)/invoices')}
          />
          <Button
            label="Done"
            variant="secondary"
            fullWidth
            onPress={() => router.replace(`/(customer)/booking/${bookingId}`)}
          />
        </>
      ) : !awaitingPayment ? (
        <>
          <Banner
            tone="info"
            title="Payment not available yet"
            message={
              statusMeta?.tone === 'warn'
                ? 'This booking is awaiting the partner. You can pay as soon as it is approved.'
                : `This booking is ${statusMeta?.label.toLowerCase() ?? b.status} — no payment is due right now.`
            }
          />
          <Button
            label="Back to booking"
            variant="secondary"
            fullWidth
            onPress={() => router.replace(`/(customer)/booking/${bookingId}`)}
          />
        </>
      ) : (
        <>
          {sandbox ? (
            <Banner
              tone="info"
              title="Sandbox environment"
              message="No real money moves in this environment. Use the buttons below to simulate the payment gateway."
            />
          ) : (
            <Banner
              tone="info"
              title={`Paying with ${config.data?.provider ?? 'the payment gateway'}`}
              message="You'll be taken to the secure checkout page. This screen refreshes automatically while you wait."
            />
          )}

          {initiate.isError ? (
            <Banner tone="danger" title="Couldn't start the payment" message={messageFor(initiate.error)} />
          ) : null}
          {browserError ? <Banner tone="warn" title="Payment setup" message={browserError} /> : null}

          {canStart && !paymentId ? (
            <Button
              label={initiate.isPending ? 'Starting payment…' : `Pay ${formatMoney(b.totalMinor, b.currency)}`}
              fullWidth
              loading={initiate.isPending}
              onPress={() => initiate.mutate()}
            />
          ) : null}

          {sandbox && paymentId ? (
            <>
              <SectionHeader title="Simulate the gateway" />
              <Card>
                <Text style={{ color: t.muted, fontSize: 13.5, lineHeight: 20 }}>
                  Payment {paymentId.slice(0, 8)}… was created. Drive the gateway outcome below —
                  the booking updates exactly as it would in production.
                </Text>
                <View style={styles.simulate}>
                  <Button
                    label="Simulate successful payment"
                    fullWidth
                    loading={simulate.isPending && simulate.variables?.outcome === 'SUCCESS'}
                    disabled={simulate.isPending}
                    onPress={() => simulate.mutate({ outcome: 'SUCCESS' })}
                  />
                  <Button
                    label="Simulate failed payment"
                    variant="danger"
                    fullWidth
                    loading={simulate.isPending && simulate.variables?.outcome === 'FAILURE'}
                    disabled={simulate.isPending}
                    onPress={() => simulate.mutate({ outcome: 'FAILURE' })}
                  />
                </View>
              </Card>

              {simulate.isError ? (
                <Banner tone="danger" title="Simulation failed" message={messageFor(simulate.error)} />
              ) : null}
              {outcome === 'failure' ? (
                <Banner
                  tone="danger"
                  title="Payment failed"
                  message="The gateway declined this payment. No money was taken — you can retry."
                />
              ) : null}
              {outcome === 'success' ? (
                <Banner tone="info" title="Confirming payment…" message="Waiting for the booking to update." />
              ) : null}
              {outcome === 'failure' || (outcome === 'success' && !paid) ? (
                <Button
                  label={outcome === 'failure' ? 'Start a new payment' : 'Refresh status'}
                  variant="secondary"
                  fullWidth
                  disabled={initiate.isPending}
                  loading={outcome === 'success' && booking.isFetching}
                  onPress={() => {
                    if (outcome === 'success') {
                      booking.refetch();
                      return;
                    }
                    setOutcome(null);
                    setPaymentId(null);
                    initiate.mutate();
                  }}
                />
              ) : null}
            </>
          ) : null}

          {!sandbox && checkoutOpened ? (
            <>
              <Banner
                tone="info"
                title="Waiting for the checkout"
                message="Complete the payment in the browser window. This screen refreshes on its own once the gateway confirms."
              />
              <View style={styles.simulate}>
                <Button
                  label="Refresh status"
                  variant="secondary"
                  fullWidth
                  loading={booking.isFetching}
                  onPress={() => booking.refetch()}
                />
                <Button
                  label="Try payment again"
                  fullWidth
                  disabled={initiate.isPending}
                  onPress={() => initiate.mutate()}
                />
              </View>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: { fontSize: 22, fontWeight: '800' },
  simulate: { gap: 10, marginTop: 12 },
});
