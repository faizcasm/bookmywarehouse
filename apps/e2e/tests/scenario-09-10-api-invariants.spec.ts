import { expect, test } from '@playwright/test';

import {
  DEMO,
  apiCall,
  apiJson,
  apiListingPayload,
  apiLogin,
  apiUrl,
  bookingWindow,
  firstWarehouseCategoryId,
  publicApi,
  signWebhook,
  uniqueId,
  type ApiSession,
} from './helpers';

/**
 * Scenarios 9–10 — API-level invariants (setup and assertions via the REST
 * API, exactly as the frontends call it):
 *
 *   9 — overlapping reservations can never exceed the listing's capacity.
 *  10 — replaying a signed payment webhook is idempotent: one payment, one
 *       invoice, booking confirmed once.
 *
 * Both tests build their own listing/booking from scratch, so they are safe
 * to re-run against a shared database.
 */
test.describe.serial('Scenarios 9-10: capacity and webhook idempotency', () => {
  let admin: ApiSession;
  let partner: ApiSession;
  let customer: ApiSession;
  let categoryId = '';

  test.beforeAll(async () => {
    [admin, partner, customer] = await Promise.all([
      apiLogin(DEMO.admin),
      apiLogin(DEMO.partner),
      apiLogin(DEMO.customer),
    ]);
    categoryId = await firstWarehouseCategoryId();
  });

  test.afterAll(async () => {
    await admin?.ctx.dispose();
    await partner?.ctx.dispose();
    await customer?.ctx.dispose();
  });

  /** Listing → publish → admin approval (PUBLISHED), returns the listing id. */
  async function createApprovedListing(title: string, capacity?: number): Promise<string> {
    const listing = await apiJson<{ id: string }>(
      partner,
      'POST',
      '/partner/listings',
      apiListingPayload({ categoryId, title, ...(capacity !== undefined ? { capacity } : {}) }),
    );
    await apiJson(partner, 'POST', `/partner/listings/${listing.id}/publish`);
    await apiJson(admin, 'PATCH', `/admin/listings/${listing.id}`, { decision: 'APPROVE' });
    return listing.id;
  }

  test('Scenario 9 — overlapping bookings cannot exceed the available capacity', async () => {
    const listingId = await createApprovedListing(`E2E capacity warehouse ${uniqueId()}`, 100);
    const window = bookingWindow(30, 3);
    const request = { listingId, startDate: window.start, endDate: window.end, capacity: 60 };

    // First reservation fits (60 of 100 pallets).
    const firstQuote = await apiJson<{ available: boolean; remainingCapacity: number | null }>(
      customer,
      'POST',
      '/bookings/quote',
      request,
    );
    expect(firstQuote.available).toBe(true);

    const first = await apiJson<{ id: string }>(customer, 'POST', '/bookings', request);
    expect(first.id, 'the first booking must be created').toBeTruthy();

    // An identical overlapping request no longer fits → quote says so …
    const overlappingQuote = await apiJson<{ available: boolean }>(
      customer,
      'POST',
      '/bookings/quote',
      request,
    );
    expect(overlappingQuote.available).toBe(false);

    // … and the booking endpoint refuses it outright.
    const { res: conflict, body: conflictBody } = await apiCall(customer, 'POST', '/bookings', request);
    expect(conflict.status()).toBe(409);
    expect(conflictBody.error?.code).toBe('CAPACITY_UNAVAILABLE');

    // Capacity that still fits within the remaining 40 pallets is accepted,
    // proving the rejection above was about capacity, not the date range.
    const { res: fits } = await apiCall(customer, 'POST', '/bookings', {
      ...request,
      capacity: 30,
    });
    expect(fits.status()).toBe(201);
  });

  test('Scenario 10 — duplicate payment webhooks create no duplicate financial records', async () => {
    const listingId = await createApprovedListing(`E2E webhook warehouse ${uniqueId()}`);
    const window = bookingWindow(45, 2);

    const booking = await apiJson<{ id: string; status: string }>(customer, 'POST', '/bookings', {
      listingId,
      startDate: window.start,
      endDate: window.end,
      quantity: 1,
    });
    const accepted = await apiJson<{ status: string }>(
      partner,
      'POST',
      `/bookings/${booking.id}/accept`,
    );
    expect(accepted.status).toBe('AWAITING_PAYMENT');

    const intent = await apiJson<{
      payment: { id: string; reference: string; amount: number; status: string };
    }>(customer, 'POST', `/payments/bookings/${booking.id}/initiate`);
    expect(intent.payment.status).toBe('PENDING');
    expect(intent.payment.amount).toBeGreaterThan(0);

    // Same event, same bytes, same signature — delivered twice.
    const event = {
      id: `evt_sbx_${uniqueId()}`,
      type: 'payment.succeeded',
      data: {
        providerPaymentId: `sbx_${intent.payment.reference.toLowerCase()}`,
        reference: intent.payment.reference,
        amountMinor: intent.payment.amount,
      },
    };
    const rawBody = JSON.stringify(event);
    const signature = signWebhook(rawBody);

    const gateway = await publicApi();
    const deliver = () =>
      gateway.post(apiUrl('/payments/webhook'), {
        headers: { 'Content-Type': 'application/json', 'x-payments-signature': signature },
        data: rawBody,
      });

    try {
      const first = await deliver();
      expect(first.status()).toBe(200);
      const firstBody = (await first.json()) as { processed?: boolean; duplicate?: boolean };
      expect(firstBody.processed).toBe(true);
      expect(firstBody.duplicate).toBe(false);

      const second = await deliver();
      expect(second.status()).toBe(200);
      const secondBody = (await second.json()) as { processed?: boolean; duplicate?: boolean };
      expect(secondBody.processed).toBe(false);
      expect(secondBody.duplicate).toBe(true);
    } finally {
      await gateway.dispose();
    }

    // Booking confirmed exactly once …
    const confirmed = await apiJson<{ status: string }>(customer, 'GET', `/bookings/${booking.id}`);
    expect(confirmed.status).toBe('CONFIRMED');

    // … exactly one payment record for this booking …
    const payments = await apiJson<{ items: { bookingId: string; status: string }[] }>(
      customer,
      'GET',
      '/payments',
    );
    const forBooking = payments.items.filter((item) => item.bookingId === booking.id);
    expect(forBooking).toHaveLength(1);
    expect(forBooking[0]?.status).toBe('SUCCEEDED');

    // … and exactly one invoice.
    const invoices = await apiJson<{ items: { bookingId: string }[] }>(
      customer,
      'GET',
      '/payments/invoices?limit=50',
    );
    expect(invoices.items.filter((item) => item.bookingId === booking.id)).toHaveLength(1);
  });
});
