import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Deterministic gateway credentials for signature assertions. These must be in
// place before any app module loads the env config.
process.env.PAYMENT_PUBLIC_KEY = process.env.PAYMENT_PUBLIC_KEY ?? 'rzp_test_dummykey01';
process.env.PAYMENT_SECRET_KEY = process.env.PAYMENT_SECRET_KEY ?? 'test_secret_key_0123456789abcdef';
process.env.PAYMENT_WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET ?? 'test_webhook_secret_0123456789abcdef';

const { config } = await import('../../config/env.js');
const { RazorpayPaymentProvider } = await import('../../services/payment.service.js');
const { app, authHeaders, closeTestDb, initTestDb, registerUser } = await import('../helpers.js');

function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

describe('Razorpay adapter', () => {
  const provider = new RazorpayPaymentProvider();

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('verifies checkout signatures exactly like the documented HMAC', () => {
    const orderId = 'order_RzTeSt123';
    const paymentId = 'pay_RzTeSt456';
    const signature = hmac(config.payment.secretKey as string, `${orderId}|${paymentId}`);

    expect(provider.verifyCheckoutSignature?.({ orderId, paymentId, signature })).toBe(true);
    expect(provider.verifyCheckoutSignature?.({ orderId, paymentId, signature: signature.replace(/.$/, '0') })).toBe(false);
    expect(provider.verifyCheckoutSignature?.({ orderId, paymentId, signature: 'short' })).toBe(false);
  });

  it('verifies webhook signatures with the webhook secret', () => {
    const raw = JSON.stringify({ event: 'payment.captured' });
    expect(provider.verifyWebhookSignature(raw, hmac(config.payment.webhookSecret, raw))).toBe(true);
    expect(provider.verifyWebhookSignature(raw, hmac('other-secret', raw))).toBe(false);
    expect(provider.verifyWebhookSignature(raw, '')).toBe(false);
  });

  it('maps payment.captured events onto the provider-agnostic shape', () => {
    const payload = {
      event: 'payment.captured',
      created_at: 1730000000,
      payload: {
        payment: {
          entity: {
            id: 'pay_ABC',
            order_id: 'order_ABC',
            amount: 250000,
            method: 'upi',
            notes: { reference: 'PAY-REF-1', bookingId: 'bkg_1' },
          },
        },
      },
    };
    const event = provider.parseWebhookEvent(JSON.stringify(payload));
    expect(event.type).toBe('payment.succeeded');
    expect(event.data.providerPaymentId).toBe('pay_ABC');
    expect(event.data.orderId).toBe('order_ABC');
    expect(event.data.reference).toBe('PAY-REF-1');
    expect(event.data.amountMinor).toBe(250000);
    expect(event.data.method).toBe('upi');
    // Stable derived id keeps replays idempotent.
    expect(event.id).toBe('payment.captured_pay_ABC_1730000000');
  });

  it('maps payment.failed and refund.processed events', () => {
    const failed = provider.parseWebhookEvent(
      JSON.stringify({
        event: 'payment.failed',
        created_at: 5,
        payload: { payment: { entity: { id: 'pay_F', order_id: 'order_F', error_description: 'Card declined' } } },
      }),
    );
    expect(failed.type).toBe('payment.failed');
    expect(failed.data.failureReason).toBe('Card declined');

    const refund = provider.parseWebhookEvent(
      JSON.stringify({
        event: 'refund.processed',
        created_at: 9,
        payload: { refund: { entity: { id: 'rfnd_X', payment_id: 'pay_ABC', amount: 10000, notes: { reference: 'PAY-REF-1' } } } },
      }),
    );
    expect(refund.type).toBe('refund.processed');
    expect(refund.data.providerPaymentId).toBe('pay_ABC');
    expect(refund.data.refundAmountMinor).toBe(10000);
  });

  it('rejects unsupported and malformed webhook payloads', () => {
    expect(() => provider.parseWebhookEvent(JSON.stringify({ event: 'order.paid' }))).toThrow(
      /Unsupported gateway event/,
    );
    expect(() => provider.parseWebhookEvent('not-json')).toThrow(/Malformed webhook payload/);
    expect(() => provider.parseWebhookEvent(JSON.stringify({ event: 'payment.captured' }))).toThrow(
      /Malformed webhook payload/,
    );
  });

  it('creates orders with the exact minor-unit amount and reference notes', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'order_NEW' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.createPaymentIntent({
      amountMinor: 123456,
      currency: 'INR',
      reference: 'PAY-NEW-1',
      metadata: { bookingId: 'bkg_9' },
    });

    expect(result.providerPaymentId).toBe('order_NEW');
    expect(result.checkoutUrl).toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.razorpay.com/v1/orders');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.amount).toBe(123456);
    expect(body.currency).toBe('INR');
    expect(body.receipt).toBe('PAY-NEW-1');
    expect(body.notes).toMatchObject({ reference: 'PAY-NEW-1', bookingId: 'bkg_9' });

    vi.unstubAllGlobals();
  });

  it('surfaces gateway order-creation failures as internal errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, text: async () => 'bad key' })));
    await expect(
      provider.createPaymentIntent({ amountMinor: 1, currency: 'INR', reference: 'X' }),
    ).rejects.toThrow(/Could not start checkout/);
    vi.unstubAllGlobals();
  });

  it('pushes refunds through the refund API in minor units', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await provider.refund?.({ providerPaymentId: 'pay_ABC', amountMinor: 5000, reason: 'Customer cancelled' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.razorpay.com/v1/payments/pay_ABC/refund');
    expect(JSON.parse(String(init.body))).toMatchObject({ amount: 5000 });

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, text: async () => 'refund failed' })));
    await expect(
      provider.refund?.({ providerPaymentId: 'pay_ABC', amountMinor: 1, reason: 'x' }),
    ).rejects.toThrow(/Could not start the refund/);
    vi.unstubAllGlobals();
  });
});

describe('payment config and verify endpoints', () => {
  let user: Awaited<ReturnType<typeof registerUser>>;

  beforeAll(async () => {
    await initTestDb();
    user = await registerUser();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('exposes public checkout config without secrets', async () => {
    const res = await request(app).get('/api/v1/payments/config').set(authHeaders(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ provider: 'SANDBOX', sandbox: true, razorpayKeyId: null });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('requires authentication for the config endpoint', async () => {
    const res = await request(app).get('/api/v1/payments/config');
    expect(res.status).toBe(401);
  });

  it('rejects verify attempts when the provider has no checkout verification', async () => {
    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set(authHeaders(user))
      .send({ orderId: 'order_X', paymentId: 'pay_X', signature: 'a'.repeat(64) });
    expect(res.status).toBe(412);
    expect(res.body.error.code).toBe('PRECONDITION_FAILED');
  });

  it('validates the verify payload shape', async () => {
    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set(authHeaders(user))
      .send({ orderId: 'order_X', paymentId: 'pay_X', signature: 'too-short' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
