import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../helpers.js';
import {
  authHeaders,
  closeTestDb,
  createPartnerListing,
  createTestCategory,
  initTestDb,
  registerAdmin,
  registerUser,
  registerVerifiedPartner,
  wipeTestDb,
  type TestUser,
} from '../helpers.js';
import { processWebhookEvent, paymentProvider } from '../../services/payment.service.js';
import { Invoice, Payment } from '../../models/index.js';

interface SandboxSigner {
  sign(payload: string): string;
}

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('payments, webhooks and invoices', () => {
  let partner: TestUser;
  let customer: TestUser;
  let stranger: TestUser;
  let admin: TestUser;
  let categoryId: string;

  beforeAll(async () => {
    await initTestDb();
    await wipeTestDb();
    partner = await registerVerifiedPartner('Payments Test Partner');
    customer = await registerUser();
    stranger = await registerUser();
    admin = await registerAdmin();
    categoryId = (await createTestCategory('WAREHOUSE', 'Payments warehouse')).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  /** Publishes a listing and creates a booking in AWAITING_PAYMENT. */
  async function bookingAwaitingPayment(title: string): Promise<string> {
    const listing = await createPartnerListing(partner, { categoryId, title });
    const publish = await request(app)
      .post(`/api/v1/partner/listings/${listing.id}/publish`)
      .set(authHeaders(partner));
    expect(publish.status).toBe(200);

    await request(app)
      .patch(`/api/v1/admin/listings/${listing.id}`)
      .set(authHeaders(admin))
      .send({ decision: 'APPROVE' });

    const created = await request(app)
      .post('/api/v1/bookings')
      .set(authHeaders(customer))
      .send({ listingId: listing.id, startDate: isoInDays(5), endDate: isoInDays(7), quantity: 1 });
    expect(created.status).toBe(201);
    const bookingId = created.body.data.id as string;

    const accept = await request(app)
      .post(`/api/v1/bookings/${bookingId}/accept`)
      .set(authHeaders(partner));
    expect(accept.body.data.status).toBe('AWAITING_PAYMENT');
    return bookingId;
  }

  it('initiates a sandbox payment without moving real money', async () => {
    const bookingId = await bookingAwaitingPayment('Sandbox payment warehouse');

    const res = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/initiate`)
      .set(authHeaders(customer));

    expect(res.status).toBe(200);
    expect(res.body.data.sandbox).toBe(true);
    expect(res.body.data.payment.amount).toBeGreaterThan(0);
    expect(res.body.data.payment.status).toBe('PENDING');
  });

  it('confirms the booking when the gateway reports success', async () => {
    const bookingId = await bookingAwaitingPayment('Gateway success warehouse');

    const intent = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/initiate`)
      .set(authHeaders(customer));
    const paymentId = intent.body.data.payment.id as string;

    const sim = await request(app)
      .post('/api/v1/payments/simulate')
      .set(authHeaders(customer))
      .send({ paymentId, outcome: 'SUCCESS' });
    expect(sim.status).toBe(200);

    const booking = await request(app)
      .get(`/api/v1/bookings/${bookingId}`)
      .set(authHeaders(customer));
    expect(booking.body.data.status).toBe('CONFIRMED');

    const payment = await Payment.findById(paymentId).lean();
    expect(payment?.status).toBe('SUCCEEDED');

    const invoices = await Invoice.find({ booking: bookingId }).lean();
    expect(invoices).toHaveLength(1);
  });

  it('refuses to let another user simulate someone else\'s payment', async () => {
    const bookingId = await bookingAwaitingPayment('Payment ownership warehouse');

    const intent = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/initiate`)
      .set(authHeaders(customer));
    const paymentId = intent.body.data.payment.id as string;

    // A stranger must not be able to flip the owner's payment (and thereby the
    // booking) to CONFIRMED — that would be a free booking with an invoice.
    const forged = await request(app)
      .post('/api/v1/payments/simulate')
      .set(authHeaders(stranger))
      .send({ paymentId, outcome: 'SUCCESS' });
    expect(forged.status).toBe(403);

    const booking = await request(app)
      .get(`/api/v1/bookings/${bookingId}`)
      .set(authHeaders(customer));
    expect(booking.body.data.status).toBe('AWAITING_PAYMENT');

    const payment = await Payment.findById(paymentId).lean();
    expect(payment?.status).toBe('PENDING');

    // The owner can still run the sandbox simulation.
    const owner = await request(app)
      .post('/api/v1/payments/simulate')
      .set(authHeaders(customer))
      .send({ paymentId, outcome: 'SUCCESS' });
    expect(owner.status).toBe(200);
  });

  it('keeps the booking unpaid when the gateway reports failure', async () => {
    const bookingId = await bookingAwaitingPayment('Gateway failure warehouse');

    const intent = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/initiate`)
      .set(authHeaders(customer));
    await request(app)
      .post('/api/v1/payments/simulate')
      .set(authHeaders(customer))
      .send({ paymentId: intent.body.data.payment.id, outcome: 'FAILURE' });

    const booking = await request(app)
      .get(`/api/v1/bookings/${bookingId}`)
      .set(authHeaders(customer));
    expect(booking.body.data.status).toBe('AWAITING_PAYMENT');
  });

  it('treats duplicate webhooks as idempotent (no duplicate financial records)', async () => {
    const bookingId = await bookingAwaitingPayment('Idempotency warehouse');

    const intent = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/initiate`)
      .set(authHeaders(customer));
    const paymentId = intent.body.data.payment.id as string;
    const payment = await Payment.findById(paymentId).lean();
    const reference = payment!.reference;

    const event = {
      id: 'evt_sbx_fixed_duplicate_test',
      type: 'payment.succeeded',
      data: { providerPaymentId: reference, reference, amountMinor: payment!.amountMinor },
    };
    const rawBody = JSON.stringify(event);
    const signature = (paymentProvider as unknown as SandboxSigner).sign(rawBody);

    const first = await processWebhookEvent(rawBody, signature);
    expect(first.processed).toBe(true);
    expect(first.duplicate).toBe(false);

    const second = await processWebhookEvent(rawBody, signature);
    expect(second.duplicate).toBe(true);
    expect(second.processed).toBe(false);

    const third = await processWebhookEvent(rawBody, signature);
    expect(third.duplicate).toBe(true);

    const invoices = await Invoice.find({ booking: bookingId }).lean();
    expect(invoices).toHaveLength(1);

    const succeeded = await Payment.find({ booking: bookingId, status: 'SUCCEEDED' }).lean();
    expect(succeeded).toHaveLength(1);
  });

  it('rejects webhooks with an invalid signature', async () => {
    const bookingId = await bookingAwaitingPayment('Bad signature warehouse');
    const intent = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/initiate`)
      .set(authHeaders(customer));

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-payments-signature', 'tampered-signature')
      .send({
        id: 'evt_bad_sig',
        type: 'payment.succeeded',
        data: { reference: intent.body.data.payment.reference },
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAYMENT_WEBHOOK_INVALID');
  });

  it('exposes only the caller\'s invoices', async () => {
    const bookingId = await bookingAwaitingPayment('Invoice access warehouse');
    const intent = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/initiate`)
      .set(authHeaders(customer));
    await request(app)
      .post('/api/v1/payments/simulate')
      .set(authHeaders(customer))
      .send({ paymentId: intent.body.data.payment.id, outcome: 'SUCCESS' });

    const list = await request(app)
      .get('/api/v1/payments/invoices?limit=50')
      .set(authHeaders(customer));
    expect(list.status).toBe(200);
    const myInvoice = list.body.data.items.find(
      (item: { bookingId?: string; booking?: { id?: string } }) =>
        item.bookingId === bookingId || item.booking?.id === bookingId,
    );
    expect(myInvoice).toBeTruthy();
    const invoiceId = (myInvoice.id ?? myInvoice._id) as string;

    const owner = await request(app)
      .get(`/api/v1/payments/invoices/${invoiceId}`)
      .set(authHeaders(customer));
    expect(owner.status).toBe(200);
    expect(owner.body.data.invoiceNumber).toBeTruthy();

    const other = await request(app)
      .get(`/api/v1/payments/invoices/${invoiceId}`)
      .set(authHeaders(stranger));
    expect(other.status).not.toBe(200);

    const adminView = await request(app)
      .get(`/api/v1/payments/invoices/${invoiceId}`)
      .set(authHeaders(admin));
    expect(adminView.status).toBe(200);

    const anonymous = await request(app).get(`/api/v1/payments/invoices/${invoiceId}`);
    expect(anonymous.status).toBe(401);
  });

  it('lists the customer\'s payment history', async () => {
    const res = await request(app)
      .get('/api/v1/payments')
      .set(authHeaders(customer));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('blocks other users from initiating payment on a booking', async () => {
    const bookingId = await bookingAwaitingPayment('Payment authorization warehouse');
    const res = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/initiate`)
      .set(authHeaders(stranger));
    expect(res.status).not.toBe(200);
  });
});
