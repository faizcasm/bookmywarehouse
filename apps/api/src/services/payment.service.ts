import { createHmac, timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import type { Currency, PaymentStatus } from '@bmw/shared-types';
import { config } from '../config/env.js';
import { errors } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { paymentReference, randomSuffix } from '../lib/ids.js';
import {
  Booking,
  Listing,
  Payment,
  PaymentEvent,
  Refund,
  type BookingFields,
  type PaymentFields,
} from '../models/index.js';
import {
  markBookingPaid,
  requestRefundState,
  transitionBooking,
  type TransitionActor,
} from './booking.service.js';
import { issueInvoiceForBooking } from './invoice.service.js';
import { notify } from './notification.service.js';
import { recordAudit } from './audit.service.js';

export interface PaymentWebhookEvent {
  id: string;
  type: 'payment.succeeded' | 'payment.failed' | 'refund.processed';
  data: {
    providerPaymentId: string;
    /** Gateway checkout order id (Razorpay) — lets webhooks match before the verify call lands. */
    orderId?: string;
    reference?: string;
    amountMinor?: number;
    method?: string;
    failureReason?: string;
    refundAmountMinor?: number;
  };
}

export interface PaymentIntentResult {
  providerPaymentId: string;
  checkoutUrl: string | null;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

export interface CheckoutSignatureInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface GatewayRefundInput {
  providerPaymentId: string;
  amountMinor: number;
  reason: string;
}

export interface PaymentProviderAdapter {
  name: string;
  createPaymentIntent(input: {
    amountMinor: number;
    currency: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntentResult>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  parseWebhookEvent(rawBody: string): PaymentWebhookEvent;
  /** Hosted-checkout gateways (Razorpay): validates the Checkout.js handler payload. */
  verifyCheckoutSignature?(input: CheckoutSignatureInput): boolean;
  /** Gateways with a refund API (Razorpay): pushes the refund; completion arrives via webhook. */
  refund?(input: GatewayRefundInput): Promise<void>;
}

/** Timing-safe comparison of two hex digests of equal length. */
function safeEqualHex(expected: string, provided: string): boolean {
  if (typeof provided !== 'string' || expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

/**
 * Clearly labeled sandbox provider. It mimics a real gateway by returning a
 * hosted checkout URL and delivering signed webhooks through the exact same
 * verification and idempotency path a live provider would use.
 */
class SandboxPaymentProvider implements PaymentProviderAdapter {
  name = 'SANDBOX';

  async createPaymentIntent(input: {
    amountMinor: number;
    currency: string;
    reference: string;
  }): Promise<PaymentIntentResult> {
    // No hosted URL: the sandbox flow is driven from the payment page through
    // the signed simulate endpoint (a route-less checkout keeps the surface honest).
    return {
      providerPaymentId: `sbx_${input.reference.toLowerCase()}`,
      checkoutUrl: null,
      status: 'PENDING',
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = createHmac('sha256', config.payment.webhookSecret).update(rawBody).digest('hex');
    return safeEqualHex(expected, signature);
  }

  parseWebhookEvent(rawBody: string): PaymentWebhookEvent {
    const parsed = JSON.parse(rawBody) as PaymentWebhookEvent;
    if (!parsed?.id || !parsed?.type || !parsed?.data?.providerPaymentId) {
      throw errors.badRequest('Malformed webhook payload');
    }
    return parsed;
  }

  sign(rawBody: string): string {
    return createHmac('sha256', config.payment.webhookSecret).update(rawBody).digest('hex');
  }
}

/* ------------------------------- Razorpay --------------------------------- */

interface RazorpayPaymentEntity {
  id: string;
  order_id?: string;
  amount?: number;
  method?: string;
  error_description?: string;
  notes?: Record<string, string>;
}

interface RazorpayEventEnvelope {
  event?: string;
  created_at?: number;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number; notes?: Record<string, string> } };
  };
}

/**
 * Live Razorpay adapter: creates Orders via the REST API, validates the
 * Checkout.js handler payload with the documented HMAC, verifies signed
 * webhooks, and pushes refunds through the refund API. Amounts are in minor
 * units (paise) throughout, exactly as Razorpay expects.
 */
export class RazorpayPaymentProvider implements PaymentProviderAdapter {
  name = 'RAZORPAY';

  private get basicAuth(): string {
    return `Basic ${Buffer.from(`${config.payment.publicKey}:${config.payment.secretKey}`).toString('base64')}`;
  }

  async createPaymentIntent(input: {
    amountMinor: number;
    currency: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntentResult> {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: this.basicAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: input.amountMinor,
        currency: input.currency,
        receipt: input.reference,
        notes: { reference: input.reference, ...(input.metadata ?? {}) },
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.error('Razorpay order creation failed', { status: response.status, body: body.slice(0, 200) });
      throw errors.internal('Could not start checkout with the payment gateway');
    }
    const order = (await response.json()) as { id: string };
    if (!order?.id) throw errors.internal('Payment gateway returned an invalid order');
    return { providerPaymentId: order.id, checkoutUrl: null, status: 'PENDING' };
  }

  /** Razorpay Checkout signature: HMAC-SHA256(order_id + '|' + payment_id) with the key secret. */
  verifyCheckoutSignature(input: CheckoutSignatureInput): boolean {
    const expected = createHmac('sha256', config.payment.secretKey ?? '')
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');
    return safeEqualHex(expected, input.signature);
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = createHmac('sha256', config.payment.webhookSecret).update(rawBody).digest('hex');
    return safeEqualHex(expected, signature);
  }

  parseWebhookEvent(rawBody: string): PaymentWebhookEvent {
    let event: RazorpayEventEnvelope;
    try {
      event = JSON.parse(rawBody) as RazorpayEventEnvelope;
    } catch {
      throw errors.badRequest('Malformed webhook payload');
    }
    const payment = event.payload?.payment?.entity;
    const refund = event.payload?.refund?.entity;
    // Razorpay events carry no unique event id; derive a stable one for idempotency.
    const eventId = (entityId: string) => `${event.event ?? 'event'}_${entityId}_${event.created_at ?? 0}`;
    switch (event.event) {
      case 'payment.captured':
        if (!payment?.id) throw errors.badRequest('Malformed webhook payload');
        return {
          id: eventId(payment.id),
          type: 'payment.succeeded',
          data: {
            providerPaymentId: payment.id,
            orderId: payment.order_id,
            reference: payment.notes?.reference,
            amountMinor: payment.amount,
            method: payment.method,
          },
        };
      case 'payment.failed':
        if (!payment?.id) throw errors.badRequest('Malformed webhook payload');
        return {
          id: eventId(payment.id),
          type: 'payment.failed',
          data: {
            providerPaymentId: payment.id,
            orderId: payment.order_id,
            reference: payment.notes?.reference,
            failureReason: payment.error_description ?? 'Payment failed',
          },
        };
      case 'refund.processed':
        if (!refund?.id || !refund.payment_id) throw errors.badRequest('Malformed webhook payload');
        return {
          id: eventId(refund.id),
          type: 'refund.processed',
          data: {
            providerPaymentId: refund.payment_id,
            reference: refund.notes?.reference,
            refundAmountMinor: refund.amount,
          },
        };
      default:
        throw errors.badRequest(`Unsupported gateway event: ${event.event ?? 'unknown'}`);
    }
  }

  async refund(input: GatewayRefundInput): Promise<void> {
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${input.providerPaymentId}/refund`,
      {
        method: 'POST',
        headers: { Authorization: this.basicAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: input.amountMinor,
          speed: 'optimum',
          notes: { reason: input.reason.slice(0, 100) },
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.error('Razorpay refund failed', { status: response.status, body: body.slice(0, 200) });
      throw errors.internal('Could not start the refund with the payment gateway');
    }
  }
}

class UnconfiguredProvider implements PaymentProviderAdapter {
  constructor(readonly name: string) {}

  async createPaymentIntent(): Promise<PaymentIntentResult> {
    throw errors.precondition(
      `Payment provider ${this.name} is selected but not configured. Set PAYMENT_* environment variables or use SANDBOX.`,
    );
  }
  verifyWebhookSignature(): boolean {
    return false;
  }
  parseWebhookEvent(): PaymentWebhookEvent {
    throw errors.badRequest('Webhooks are not supported by the configured provider');
  }
}

function resolveProvider(): PaymentProviderAdapter {
  switch (config.payment.provider) {
    case 'SANDBOX':
      return new SandboxPaymentProvider();
    case 'RAZORPAY':
      return new RazorpayPaymentProvider();
    case 'STRIPE':
      // Follow-up slot behind the same adapter interface; selecting it without
      // credentials yields a clear, actionable error instead of silent failures.
      return new UnconfiguredProvider(config.payment.provider);
    default:
      return new SandboxPaymentProvider();
  }
}

export const paymentProvider: PaymentProviderAdapter = resolveProvider();

export function isSandbox(): boolean {
  return paymentProvider.name === 'SANDBOX';
}

/** Public payment config for the checkout UI (no secrets — key id only). */
export function paymentPublicConfig(): {
  provider: string;
  sandbox: boolean;
  razorpayKeyId: string | null;
} {
  return {
    provider: paymentProvider.name,
    sandbox: isSandbox(),
    razorpayKeyId:
      paymentProvider.name === 'RAZORPAY' ? (config.payment.publicKey ?? null) : null,
  };
}

export interface InitiatePaymentResult {
  payment: PaymentFields & { _id: unknown };
  checkoutUrl: string | null;
  provider: string;
}

export async function initiatePayment(
  customerId: string,
  bookingId: string,
): Promise<InitiatePaymentResult> {
  if (!Types.ObjectId.isValid(bookingId)) throw errors.notFound('Booking not found');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw errors.notFound('Booking not found');
  if (String(booking.customer) !== customerId) throw errors.forbidden('Not your booking');
  if (booking.status !== 'AWAITING_PAYMENT') {
    throw errors.invalidTransition('This booking is not awaiting payment');
  }

  const existing = await Payment.findOne({ booking: booking._id, status: { $in: ['PENDING', 'PROCESSING'] } });
  if (existing) {
    return {
      payment: existing as unknown as PaymentFields & { _id: unknown },
      checkoutUrl: null,
      provider: existing.provider,
    };
  }

  const reference = paymentReference();
  const intent = await paymentProvider.createPaymentIntent({
    amountMinor: booking.pricing.totalMinor,
    currency: booking.pricing.currency,
    reference,
    metadata: { bookingId: String(booking._id), reference: booking.reference },
  });

  const payment = await Payment.create({
    booking: booking._id,
    reference,
    provider: paymentProvider.name,
    providerPaymentId: intent.providerPaymentId,
    amountMinor: booking.pricing.totalMinor,
    currency: booking.pricing.currency,
    status: 'PENDING',
    metadata: { sandbox: isSandbox() },
  });

  booking.payment = payment._id;
  await booking.save();

  return {
    payment: payment as unknown as PaymentFields & { _id: unknown },
    checkoutUrl: intent.checkoutUrl,
    provider: paymentProvider.name,
  };
}

/**
 * Development-only helper that plays the role of the gateway: it signs a webhook
 * event and feeds it through the real webhook pipeline.
 */
export async function simulateGatewayResult(
  paymentId: string,
  outcome: 'SUCCESS' | 'FAILURE',
): Promise<{ eventId: string; processed: boolean }> {
  if (paymentProvider.name !== 'SANDBOX') {
    throw errors.forbidden('Sandbox simulation is only available with the SANDBOX provider');
  }
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw errors.notFound('Payment not found');

  const event: PaymentWebhookEvent = {
    id: `evt_sbx_${randomSuffix()}`,
    type: outcome === 'SUCCESS' ? 'payment.succeeded' : 'payment.failed',
    data: {
      providerPaymentId: payment.providerPaymentId ?? payment.reference,
      reference: payment.reference,
      amountMinor: payment.amountMinor,
      method: outcome === 'SUCCESS' ? 'sandbox_netbanking' : undefined,
      failureReason: outcome === 'FAILURE' ? 'Sandbox simulated failure' : undefined,
    },
  };
  const rawBody = JSON.stringify(event);
  const signature = (paymentProvider as SandboxPaymentProvider).sign(rawBody);
  const result = await processWebhookEvent(rawBody, signature);
  return { eventId: event.id, processed: result.processed };
}

/**
 * Single success path shared by the webhook pipeline and the checkout verify
 * endpoint: marks the payment paid, moves the booking, issues the invoice and
 * notifies the customer.
 */
async function markPaymentSucceeded(
  payment: { booking: unknown; amountMinor: number; currency: string; status: PaymentStatus; save(): Promise<unknown> },
  method: string | null,
): Promise<void> {
  payment.status = 'SUCCEEDED';
  (payment as { paidAt?: Date }).paidAt = new Date();
  (payment as { method?: string | null }).method = method;
  await payment.save();

  const booking = await Booking.findById(payment.booking);
  if (!booking) return;
  await markBookingPaid(String(booking._id));
  const invoice = await issueInvoiceForBooking(String(booking._id));
  if (invoice) {
    booking.invoice = invoice._id;
    await booking.save();
  }
  await notify({
    userId: String(booking.customer),
    type: 'PAYMENT_SUCCEEDED',
    title: 'Payment successful',
    body: `We received your payment of ${payment.amountMinor / 100} ${payment.currency} for booking ${booking.reference}.`,
    link: `/dashboard/bookings/${String(booking._id)}`,
  });
}

export interface WebhookResult {
  processed: boolean;
  duplicate: boolean;
  status: PaymentStatus | null;
}

export async function processWebhookEvent(rawBody: string, signature: string): Promise<WebhookResult> {
  if (!paymentProvider.verifyWebhookSignature(rawBody, signature)) {
    throw errors.webhookInvalid();
  }
  const event = paymentProvider.parseWebhookEvent(rawBody);

  // Idempotency: the first write wins; duplicates are acknowledged and ignored.
  let record;
  try {
    record = await PaymentEvent.create({
      eventId: event.id,
      type: event.type,
      payloadHash: createHmac('sha256', 'bmw-webhook').update(rawBody).digest('hex'),
      status: 'PROCESSED',
      processedAt: new Date(),
    });
  } catch (error) {
    const duplicate = (error as { code?: number }).code === 11000;
    if (duplicate) {
      logger.info('Duplicate webhook ignored', { eventId: event.id });
      const existingPayment = await Payment.findOne({
        providerPaymentId: event.data.providerPaymentId,
      }).lean();
      return { processed: false, duplicate: true, status: (existingPayment?.status ?? null) as PaymentStatus | null };
    }
    throw error;
  }

  const payment = await Payment.findOne({
    $or: [
      { providerPaymentId: event.data.providerPaymentId },
      ...(event.data.reference ? [{ reference: event.data.reference }] : []),
    ],
  });

  if (!payment) {
    record.status = 'FAILED';
    record.error = 'No matching payment';
    await record.save();
    throw errors.notFound('No payment matches this webhook event');
  }
  record.payment = payment._id;

  if (event.type === 'payment.succeeded') {
    if (payment.status === 'SUCCEEDED') {
      record.status = 'DUPLICATE';
      await record.save();
      return { processed: false, duplicate: true, status: 'SUCCEEDED' };
    }
    // Hosted-checkout gateways match by order id first — upgrade to the
    // gateway payment id so refunds and later events find the same record.
    if (event.data.orderId && payment.providerPaymentId !== event.data.providerPaymentId) {
      payment.providerPaymentId = event.data.providerPaymentId;
    }
    await markPaymentSucceeded(payment, event.data.method ?? null);
  } else if (event.type === 'payment.failed') {
    payment.status = 'FAILED';
    payment.failureReason = event.data.failureReason ?? 'Payment failed';
    await payment.save();
    const booking = await Booking.findById(payment.booking).lean();
    if (booking) {
      await notify({
        userId: String(booking.customer),
        type: 'PAYMENT_FAILED',
        title: 'Payment failed',
        body: `Your payment for booking ${booking.reference} did not go through. You can retry from your dashboard.`,
        link: `/dashboard/bookings/${String(booking._id)}`,
      });
    }
  } else if (event.type === 'refund.processed') {
    const refund = await Refund.findOne({ payment: payment._id, status: { $in: ['PENDING', 'PROCESSING'] } });
    if (refund) {
      refund.status = 'COMPLETED';
      refund.processedAt = new Date();
      await refund.save();
    }
    if (payment.status !== 'REFUNDED') {
      payment.status = 'REFUNDED';
      await payment.save();
    }
    const booking = await Booking.findById(payment.booking);
    if (booking && booking.status === 'REFUND_PENDING') {
      await transitionBooking(String(booking._id), 'REFUNDED', { userId: 'system', role: 'ADMIN' }, {
        note: 'Refund processed by gateway',
      });
    }
  }

  record.status = 'PROCESSED';
  await record.save();
  return { processed: true, duplicate: false, status: payment.status };
}

export interface VerifyCheckoutInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

/**
 * Confirms a hosted-checkout payment from the browser handler payload. The
 * HMAC signature proves Razorpay processed the payment for our order (which
 * was created with the exact booking amount), so no client amounts are trusted.
 * Idempotent: replaying a verified payload returns alreadyProcessed.
 */
export async function verifyCheckoutPayment(
  userId: string,
  input: VerifyCheckoutInput,
): Promise<{ paymentId: string; status: PaymentStatus; alreadyProcessed: boolean }> {
  if (!paymentProvider.verifyCheckoutSignature) {
    throw errors.precondition(
      `The configured provider (${paymentProvider.name}) does not use checkout signature verification`,
    );
  }
  if (!paymentProvider.verifyCheckoutSignature(input)) {
    throw errors.webhookInvalid();
  }

  const payment = await Payment.findOne({ providerPaymentId: input.orderId });
  if (!payment) throw errors.notFound('Payment not found');
  const booking = await Booking.findById(payment.booking);
  if (!booking || String(booking.customer) !== userId) throw errors.forbidden('Not your payment');

  if (payment.status === 'SUCCEEDED') {
    return { paymentId: String(payment._id), status: payment.status, alreadyProcessed: true };
  }

  payment.providerPaymentId = input.paymentId; // keep the gateway payment id for refunds/webhooks
  await markPaymentSucceeded(payment, null);
  return { paymentId: String(payment._id), status: payment.status, alreadyProcessed: false };
}

export interface RefundCalculationInput {
  booking: Pick<BookingFields, 'pricing' | 'status'> & { _id: unknown };
  cancelledByRole: 'CUSTOMER' | 'PARTNER' | 'ADMIN';
  refundPercent: number;
  reason: string;
}

export async function createRefundForBooking(input: {
  bookingId: string;
  refundPercent: number;
  reason: string;
  actor: TransitionActor;
}): Promise<{ refundId: string; amountMinor: number } | null> {
  const booking = await Booking.findById(input.bookingId);
  if (!booking) throw errors.notFound('Booking not found');
  const payment = await Payment.findOne({ booking: booking._id, status: 'SUCCEEDED' });
  if (!payment) return null;

  const amountMinor = Math.min(
    payment.amountMinor,
    Math.round((payment.amountMinor * input.refundPercent) / 100),
  );
  if (amountMinor <= 0) return null;

  const refund = await Refund.create({
    payment: payment._id,
    booking: booking._id,
    amountMinor,
    currency: payment.currency,
    status: 'PENDING',
    reason: input.reason,
  });

  // Live gateways: push the refund immediately; the refund.processed webhook
  // completes the record. On failure the refund stays PENDING for an admin retry.
  if (paymentProvider.refund && typeof payment.providerPaymentId === 'string' && payment.providerPaymentId.startsWith('pay_')) {
    try {
      await paymentProvider.refund({
        providerPaymentId: payment.providerPaymentId,
        amountMinor,
        reason: input.reason,
      });
      refund.status = 'PROCESSING';
      await refund.save();
    } catch (error) {
      logger.error('Gateway refund request failed — an admin can retry it from the console', {
        refundId: String(refund._id),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  payment.status = amountMinor >= payment.amountMinor ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  await payment.save();
  await requestRefundState(String(booking._id), input.reason);

  await notify({
    userId: String(booking.customer),
    type: 'REFUND_PROCESSED',
    title: 'Refund initiated',
    body: `A refund of ${(amountMinor / 100).toFixed(2)} ${payment.currency} has been initiated for booking ${booking.reference}.`,
    link: `/dashboard/bookings/${String(booking._id)}`,
  });

  return { refundId: String(refund._id), amountMinor };
}

/** Admin action: completes a pending refund (sandbox marks it processed immediately). */
export async function completeRefund(
  refundId: string,
  actor: { userId: string; role: string },
): Promise<void> {
  const refund = await Refund.findById(refundId);
  if (!refund) throw errors.notFound('Refund not found');
  if (refund.status === 'COMPLETED') return;
  refund.status = 'COMPLETED';
  refund.processedAt = new Date();
  await refund.save();

  const payment = await Payment.findById(refund.payment);
  if (payment) {
    payment.status = refund.amountMinor >= payment.amountMinor ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await payment.save();
  }
  const booking = await Booking.findById(refund.booking);
  if (booking && booking.status === 'REFUND_PENDING') {
    booking.status = 'REFUNDED';
    booking.statusHistory.push({
      status: 'REFUNDED',
      at: new Date(),
      byRole: 'ADMIN',
      note: 'Refund completed by administrator',
    });
    await booking.save();
    await notify({
      userId: String(booking.customer),
      type: 'REFUND_PROCESSED',
      title: 'Refund completed',
      body: `Your refund for booking ${booking.reference} has been processed.`,
      link: `/dashboard/bookings/${String(booking._id)}`,
    });
  }
  await recordAudit({
    actorId: actor.userId,
    action: 'refund.completed',
    entityType: 'Refund',
    entityId: refundId,
    summary: `Refund of ${refund.amountMinor} ${refund.currency} completed`,
  });
}

/** Cancels a booking and applies the listing cancellation policy to any refund. */
export async function cancelBookingWithPolicy(
  bookingId: string,
  actor: TransitionActor,
  reason: string,
): Promise<{ refundAmountMinor: number | null }> {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw errors.notFound('Booking not found');
  const listing = await Listing.findById(booking.listing).lean();

  const isCustomer = String(booking.customer) === actor.userId;
  const percent = isCustomer
    ? (listing?.cancellationTerms.customerRefundPercent ?? 0)
    : 100;

  const updated = await transitionBooking(bookingId, 'CANCELLED', actor, { reason });
  const refund = await createRefundForBooking({
    bookingId,
    refundPercent: percent,
    reason: `Cancellation: ${reason}`,
    actor,
  });

  if (refund) {
    updated.cancellationReason = `${reason} (refund of ${(refund.amountMinor / 100).toFixed(2)} initiated)`;
    await Booking.findByIdAndUpdate(bookingId, { cancellationReason: updated.cancellationReason });
  }

  return { refundAmountMinor: refund?.amountMinor ?? null };
}

export { logger };
export type { Currency };
