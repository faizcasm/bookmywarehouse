import { createHmac, timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import type { Currency, PaymentStatus } from '@bmw/shared-types';
import { config, env } from '../config/env.js';
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
    return {
      providerPaymentId: `sbx_${input.reference.toLowerCase()}`,
      checkoutUrl: `${env.CUSTOMER_APP_URL}/sandbox/checkout?paymentId=${input.reference}&amount=${input.amountMinor}&currency=${input.currency}`,
      status: 'PENDING',
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = createHmac('sha256', config.payment.webhookSecret).update(rawBody).digest('hex');
    if (expected.length !== signature.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
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
    case 'STRIPE':
      // Live credentials are not available in this environment; selecting these
      // providers yields a clear, actionable error instead of silent failures.
      return new UnconfiguredProvider(config.payment.provider);
    default:
      return new SandboxPaymentProvider();
  }
}

export const paymentProvider: PaymentProviderAdapter = resolveProvider();

export function isSandbox(): boolean {
  return paymentProvider.name === 'SANDBOX';
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
    payment.status = 'SUCCEEDED';
    payment.paidAt = new Date();
    payment.method = event.data.method ?? null;
    await payment.save();

    const booking = await Booking.findById(payment.booking);
    if (booking) {
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
