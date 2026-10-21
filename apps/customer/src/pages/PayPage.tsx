import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CreditCard, Loader2, Lock } from 'lucide-react';
import { ApiError, api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatMoney } from '../lib/format';
import type { BookingDTO, PaymentConfigDTO, PaymentInitiateDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { ErrorState, PageLoader } from '../components/Skeleton';

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 20;

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

/** Injects Razorpay Checkout.js once; resolves when the global is available. */
function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('rzp-checkout-js');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay Checkout')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'rzp-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout'));
    document.body.appendChild(script);
  });
}

export function PayPage() {
  const { bookingId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const bookingState = useAsyncData<BookingDTO>(() => api.get(`/bookings/${bookingId}`), [bookingId]);
  const booking = bookingState.data;
  const configState = useAsyncData<PaymentConfigDTO>(() => api.get('/payments/config'), []);
  const config = configState.data;

  const [payment, setPayment] = useState<PaymentInitiateDTO | null>(null);
  const [busy, setBusy] = useState<'initiate' | 'success' | 'failure' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  const startPolling = () => {
    setPolling(true);
    let attempts = 0;
    pollRef.current = window.setInterval(async () => {
      attempts += 1;
      try {
        const fresh = await api.get<BookingDTO>(`/bookings/${bookingId}`);
        if (fresh.status !== 'AWAITING_PAYMENT') {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setPolling(false);
          toast.push('Payment received — your booking is confirmed!', 'success');
          navigate(`/bookings/${bookingId}`, { replace: true });
          return;
        }
      } catch {
        /* keep polling */
      }
      if (attempts >= MAX_POLLS) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setPolling(false);
        toast.push('Payment is still processing. Check the booking page in a moment.', 'info');
        navigate(`/bookings/${bookingId}`, { replace: true });
      }
    }, POLL_INTERVAL_MS);
  };

  /** Sandbox: simulate the gateway result through the signed webhook pipeline. */
  const onSimulate = async (outcome: 'SUCCESS' | 'FAILURE') => {
    if (!payment) return;
    setBusy(outcome === 'SUCCESS' ? 'success' : 'failure');
    setError(null);
    try {
      await api.post('/payments/simulate', { paymentId: payment.payment.id, outcome });
      if (outcome === 'SUCCESS') {
        startPolling();
      } else {
        toast.push('Simulated payment failure — you can retry.', 'error');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not simulate the payment.');
    } finally {
      setBusy(null);
    }
  };

  /** Live Razorpay: open the hosted Checkout modal, then confirm the signature. */
  const openRazorpay = async (initiated: PaymentInitiateDTO) => {
    if (!initiated.razorpay || !config?.razorpayKeyId) return;
    await loadRazorpayScript();
    const rzp = new window.Razorpay!({
      key: config.razorpayKeyId,
      order_id: initiated.razorpay.orderId,
      amount: initiated.payment.amount,
      currency: initiated.payment.currency,
      name: 'BookMyWarehouse',
      description: booking?.reference,
      theme: { color: '#2563eb' },
      handler: async (response: { order_id: string; payment_id: string; signature: string }) => {
        setBusy('success');
        setError(null);
        try {
          await api.post('/payments/verify', {
            orderId: response.order_id,
            paymentId: response.payment_id,
            signature: response.signature,
          });
          startPolling();
        } catch (err) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'The payment could not be confirmed. Refresh the page or contact support with your reference.',
          );
        } finally {
          setBusy(null);
        }
      },
      modal: {
        ondismiss: () => {
          setBusy(null);
          setPayment(null);
          toast.push('Checkout closed — you can retry whenever you are ready.', 'info');
        },
      },
    });
    rzp.open();
  };

  const onPay = async () => {
    setBusy('initiate');
    setError(null);
    try {
      const result = await api.post<PaymentInitiateDTO>(`/payments/bookings/${bookingId}/initiate`, {});
      setPayment(result);
      if (result.razorpay) {
        await openRazorpay(result);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the payment.');
    } finally {
      setBusy(null);
    }
  };

  if (bookingState.loading || (configState.loading && !config)) return <PageLoader label="Loading checkout…" />;
  if (bookingState.error || !booking) {
    return (
      <div className="container page">
        <ErrorState message={bookingState.error?.message ?? 'Booking not found.'} onRetry={bookingState.reload} />
      </div>
    );
  }

  const alreadyPaid = booking.status !== 'AWAITING_PAYMENT';
  const isSandbox = config?.sandbox ?? true;

  return (
    <div className="container page pay-page">
      <div className="card auth-card pay-card">
        {isSandbox ? (
          <div className="sandbox-banner" role="note">
            <strong>Sandbox checkout — no real money moves.</strong>
            <span>Payments are simulated end-to-end until a live gateway is configured.</span>
          </div>
        ) : null}

        <h1>Complete your payment</h1>
        <div className="pay-booking-ref">
          <Link to={`/bookings/${booking.id}`}>{booking.reference}</Link>{' '}
          <StatusBadge status={booking.status} />
        </div>

        <dl className="summary-list">
          <div>
            <dt>Listing</dt>
            <dd>{booking.listing.title}</dd>
          </div>
          <div>
            <dt>Amount due</dt>
            <dd className="pay-amount">{formatMoney(booking.pricing.total, booking.pricing.currency)}</dd>
          </div>
        </dl>

        {alreadyPaid ? (
          <>
            <p className="form-success" role="status">
              This booking is already <strong>{booking.status.replace('_', ' ').toLowerCase()}</strong> — no
              payment is due.
            </p>
            <Link to={`/bookings/${booking.id}`} className="btn btn-primary btn-block">
              View booking
            </Link>
          </>
        ) : !payment ? (
          <>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => void onPay()}
              disabled={busy === 'initiate'}
            >
              {busy === 'initiate' ? (
                <>
                  <Loader2 className="spin" size={16} aria-hidden="true" /> Starting checkout…
                </>
              ) : (
                <>
                  <Lock size={15} aria-hidden="true" /> Pay {formatMoney(booking.pricing.total, booking.pricing.currency)}
                </>
              )}
            </button>
            {isSandbox ? null : (
              <p className="field-hint pay-secure-hint">
                <CreditCard size={13} aria-hidden="true" /> Payments are processed securely by Razorpay — UPI, cards,
                netbanking and wallets.
              </p>
            )}
          </>
        ) : payment.sandbox ? (
          <>
            <section className="payment-box" aria-label="Payment details">
              <dl className="summary-list">
                <div>
                  <dt>Payment reference</dt>
                  <dd className="mono">{payment.payment.reference}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>
                    {payment.payment.provider}{' '}
                    {payment.sandbox ? <span className="badge tone-warn">Sandbox</span> : null}
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{payment.payment.status}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{formatMoney(payment.payment.amount, payment.payment.currency)}</dd>
                </div>
              </dl>
              {payment.message ? <p className="muted">{payment.message}</p> : null}
            </section>

            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="pay-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void onSimulate('SUCCESS')}
                disabled={busy !== null || polling}
              >
                {busy === 'success' || polling ? 'Processing…' : 'Simulate successful payment'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void onSimulate('FAILURE')}
                disabled={busy !== null || polling}
              >
                {busy === 'failure' ? 'Simulating…' : 'Simulate failed payment'}
              </button>
            </div>
            {polling ? (
              <p className="muted" role="status">
                Confirming payment with the server…
              </p>
            ) : null}
            <p className="field-hint">
              Sandbox webhooks drive the booking state machine exactly like production.
            </p>
          </>
        ) : (
          <>
            <section className="payment-box" aria-label="Payment details">
              <dl className="summary-list">
                <div>
                  <dt>Payment reference</dt>
                  <dd className="mono">{payment.payment.reference}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{payment.payment.status}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{formatMoney(payment.payment.amount, payment.payment.currency)}</dd>
                </div>
              </dl>
            </section>

            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => void onPay()}
              disabled={busy !== null || polling}
            >
              {busy === 'initiate' || polling ? (
                <>
                  <Loader2 className="spin" size={16} aria-hidden="true" /> {polling ? 'Confirming payment…' : 'Opening checkout…'}
                </>
              ) : (
                <>
                  <Lock size={15} aria-hidden="true" /> Retry payment
                </>
              )}
            </button>
            {polling ? (
              <p className="muted" role="status">
                Confirming payment with the server…
              </p>
            ) : null}
            <p className="field-hint pay-secure-hint">
              <CreditCard size={13} aria-hidden="true" /> You will complete the payment on Razorpay's secure checkout.
            </p>
          </>
        )}

        <div className="auth-links">
          <Link to={`/bookings/${booking.id}`}>← Back to booking</Link>
        </div>
      </div>
    </div>
  );
}
