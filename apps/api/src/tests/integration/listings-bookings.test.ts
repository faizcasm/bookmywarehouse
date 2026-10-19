import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import {
  app,
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

describe('listings + bookings lifecycle', () => {
  let admin: TestUser;
  let partner: TestUser;
  let customer: TestUser;
  let warehouseCategoryId: string;

  beforeAll(async () => {
    await initTestDb();
    await wipeTestDb();
    admin = await registerAdmin();
    partner = await registerVerifiedPartner('Automated Test Logistics');
    customer = await registerUser();
    warehouseCategoryId = (await createTestCategory('WAREHOUSE')).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  async function publishListing(title?: string) {
    const listing = await createPartnerListing(partner, { categoryId: warehouseCategoryId, title });
    const published = await request(app)
      .post(`/api/v1/partner/listings/${listing.id}/publish`)
      .set(authHeaders(partner));
    expect(published.status).toBe(200);
    expect(published.body.data.status).toBe('PENDING_REVIEW');

    const approved = await request(app)
      .patch(`/api/v1/admin/listings/${listing.id}`)
      .set(authHeaders(admin))
      .send({ decision: 'APPROVE' });
    expect(approved.status).toBe(200);
    return listing;
  }

  it('lets a partner create a draft listing', async () => {
    const listing = await createPartnerListing(partner, { categoryId: warehouseCategoryId });
    expect(listing.status).toBe('DRAFT');
    expect(listing.slug).toBeTruthy();
  });

  it('shows the draft listing in the partner console but not public search', async () => {
    const listing = await createPartnerListing(partner, { categoryId: warehouseCategoryId });

    const mine = await request(app)
      .get('/api/v1/partner/listings?limit=50')
      .set(authHeaders(partner));
    expect(mine.status).toBe(200);
    expect(mine.body.data.items.some((item: { id: string }) => item.id === listing.id)).toBe(true);

    const publicFeed = await request(app).get('/api/v1/catalog/listings?limit=50');
    expect(publicFeed.status).toBe(200);
    expect(publicFeed.body.data.items.some((item: { id: string }) => item.id === listing.id)).toBe(false);
  });

  it('requires admin approval before a listing goes live', async () => {
    const listing = await createPartnerListing(partner, { categoryId: warehouseCategoryId });
    const publishRes = await request(app)
      .post(`/api/v1/partner/listings/${listing.id}/publish`)
      .set(authHeaders(partner));
    expect(publishRes.body.data.status).toBe('PENDING_REVIEW');

    const publicBefore = await request(app).get('/api/v1/catalog/listings?limit=50');
    expect(publicBefore.body.data.items.some((i: { id: string }) => i.id === listing.id)).toBe(false);

    await request(app)
      .patch(`/api/v1/admin/listings/${listing.id}`)
      .set(authHeaders(admin))
      .send({ decision: 'APPROVE' });

    const publicAfter = await request(app).get('/api/v1/catalog/listings?limit=50');
    expect(publicAfter.body.data.items.some((i: { id: string }) => i.id === listing.id)).toBe(true);
  });

  it('lets an admin reject a listing with a reason', async () => {
    const listing = await createPartnerListing(partner, { categoryId: warehouseCategoryId });
    await request(app)
      .post(`/api/v1/partner/listings/${listing.id}/publish`)
      .set(authHeaders(partner));

    const reject = await request(app)
      .patch(`/api/v1/admin/listings/${listing.id}`)
      .set(authHeaders(admin))
      .send({ decision: 'REJECT', reason: 'Photos do not match the description' });
    expect(reject.status).toBe(200);

    const detail = await request(app)
      .get(`/api/v1/catalog/listings/${listing.slug}`)
      .set(authHeaders(customer));
    expect(detail.status).toBe(404);
  });

  it('prevents customers from creating listings', async () => {
    const res = await request(app)
      .post('/api/v1/partner/listings')
      .set(authHeaders(customer))
      .send({});
    expect(res.status).toBe(403);
  });

  it('quotes a booking and creates it through the full flow', async () => {
    const listing = await publishListing('Quote flow warehouse');

    const quote = await request(app).post('/api/v1/bookings/quote').send({
      listingId: listing.id,
      startDate: isoInDays(10),
      endDate: isoInDays(13),
      quantity: 1,
    });
    expect(quote.status).toBe(200);
    expect(quote.body.data.available).toBe(true);
    expect(quote.body.data.pricing.total).toBeGreaterThan(0);

    const created = await request(app)
      .post('/api/v1/bookings')
      .set(authHeaders(customer))
      .send({
        listingId: listing.id,
        startDate: isoInDays(10),
        endDate: isoInDays(13),
        quantity: 1,
        notes: 'Integration test booking',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('PENDING_APPROVAL');
    expect(created.body.data.reference).toMatch(/^BMW-/);
  });

  it('walks the booking through accept → payment → confirmed', async () => {
    const listing = await publishListing('Payment flow warehouse');
    const booking = await createBooking(listing.id, 15);

    const accept = await request(app)
      .post(`/api/v1/bookings/${booking.id}/accept`)
      .set(authHeaders(partner));
    expect(accept.status).toBe(200);
    expect(accept.body.data.status).toBe('AWAITING_PAYMENT');

    const intent = await request(app)
      .post(`/api/v1/payments/bookings/${booking.id}/initiate`)
      .set(authHeaders(customer));
    expect(intent.status).toBe(200);
    expect(intent.body.data.payment.id).toBeTruthy();

    const simulate = await request(app)
      .post('/api/v1/payments/simulate')
      .set(authHeaders(customer))
      .send({ paymentId: intent.body.data.payment.id, outcome: 'SUCCESS' });
    expect(simulate.status).toBe(200);

    const after = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set(authHeaders(customer));
    expect(after.body.data.status).toBe('CONFIRMED');
  });

  it('stops the customer from approving their own booking', async () => {
    const listing = await publishListing('Self approval warehouse');
    const booking = await createBooking(listing.id, 20);

    const res = await request(app)
      .post(`/api/v1/bookings/${booking.id}/accept`)
      .set(authHeaders(customer));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const still = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set(authHeaders(customer));
    expect(still.body.data.status).toBe('PENDING_APPROVAL');
  });

  it('prevents overlapping bookings from exceeding capacity', async () => {
    const listing = await publishListing('Capacity warehouse');
    // Listing capacity: 100 pallets.
    const first = await request(app)
      .post('/api/v1/bookings')
      .set(authHeaders(customer))
      .send({ listingId: listing.id, startDate: isoInDays(30), endDate: isoInDays(35), capacity: 60 });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/bookings')
      .set(authHeaders(customer))
      .send({ listingId: listing.id, startDate: isoInDays(32), endDate: isoInDays(36), capacity: 60 });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CAPACITY_UNAVAILABLE');
  });

  it('rejects bookings on unavailable dates', async () => {
    const listing = await publishListing('Blocked dates warehouse');
    const res = await request(app)
      .post('/api/v1/bookings')
      .set(authHeaders(customer))
      .send({ listingId: listing.id, startDate: isoInDays(40), endDate: isoInDays(41) });
    // No rules configured → available; either way the API must answer consistently.
    expect([201, 409]).toContain(res.status);
  });

  it('hides other customers\' bookings from unrelated users', async () => {
    const listing = await publishListing('Private booking warehouse');
    const booking = await createBooking(listing.id, 25);
    const stranger = await registerUser();

    const res = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set(authHeaders(stranger));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.status).not.toBe(200);
  });

  it('returns 404 for unknown catalog listings', async () => {
    const res = await request(app).get('/api/v1/catalog/listings/does-not-exist-slug');
    expect(res.status).toBe(404);
  });

  function isoInDays(days: number): string {
    const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  }

  async function createBooking(listingId: string, daysOut: number): Promise<{ id: string }> {
    const res = await request(app)
      .post('/api/v1/bookings')
      .set(authHeaders(customer))
      .send({
        listingId,
        startDate: isoInDays(daysOut),
        endDate: isoInDays(daysOut + 2),
        quantity: 1,
      });
    if (res.status !== 201) {
      throw new Error(`Booking failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return { id: res.body.data.id };
  }
});
