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

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('reviews eligibility', () => {
  let partner: TestUser;
  let customer: TestUser;
  let stranger: TestUser;
  let admin: TestUser;
  let categoryId: string;

  beforeAll(async () => {
    await initTestDb();
    await wipeTestDb();
    partner = await registerVerifiedPartner('Reviews Test Partner');
    customer = await registerUser();
    stranger = await registerUser();
    admin = await registerAdmin();
    categoryId = (await createTestCategory('WAREHOUSE', 'Reviews warehouse')).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  /** Creates a booking and drives it to COMPLETED through the real APIs. */
  async function completedBooking(title: string): Promise<{ bookingId: string; slug: string }> {
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
      .send({ listingId: listing.id, startDate: isoInDays(6), endDate: isoInDays(8), quantity: 1 });
    expect(created.status).toBe(201);
    const bookingId = created.body.data.id as string;

    await request(app)
      .post(`/api/v1/bookings/${bookingId}/accept`)
      .set(authHeaders(partner));

    const intent = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/initiate`)
      .set(authHeaders(customer));
    await request(app)
      .post('/api/v1/payments/simulate')
      .set(authHeaders(customer))
      .send({ paymentId: intent.body.data.payment.id, outcome: 'SUCCESS' });

    const complete = await request(app)
      .post(`/api/v1/bookings/${bookingId}/complete`)
      .set(authHeaders(partner))
      .send({ note: 'Work finished in the test suite' });
    expect(complete.status).toBe(200);
    expect(complete.body.data.status).toBe('COMPLETED');

    return { bookingId, slug: listing.slug };
  }

  it('rejects reviews for bookings that are not completed', async () => {
    const listing = await createPartnerListing(partner, { categoryId, title: 'Not completed warehouse' });
    await request(app)
      .post(`/api/v1/partner/listings/${listing.id}/publish`)
      .set(authHeaders(partner));
    await request(app)
      .patch(`/api/v1/admin/listings/${listing.id}`)
      .set(authHeaders(admin))
      .send({ decision: 'APPROVE' });
    const created = await request(app)
      .post('/api/v1/bookings')
      .set(authHeaders(customer))
      .send({ listingId: listing.id, startDate: isoInDays(9), endDate: isoInDays(10), quantity: 1 });
    expect(created.status).toBe(201);

    const res = await request(app)
      .post('/api/v1/reviews')
      .set(authHeaders(customer))
      .send({ bookingId: created.body.data.id, rating: 5, comment: 'Too early' });
    expect(res.status).toBe(412);
  });

  it('rejects reviews from users who do not own the booking', async () => {
    const { bookingId } = await completedBooking('Not your booking warehouse');
    const res = await request(app)
      .post('/api/v1/reviews')
      .set(authHeaders(stranger))
      .send({ bookingId, rating: 1, comment: 'Should not be allowed' });
    expect(res.status).toBe(403);
  });

  it('accepts a review from the customer after completion, then blocks duplicates', async () => {
    const { bookingId, slug } = await completedBooking('Happy path warehouse');

    const first = await request(app)
      .post('/api/v1/reviews')
      .set(authHeaders(customer))
      .send({ bookingId, rating: 5, comment: 'Excellent service, would book again.' });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/v1/reviews')
      .set(authHeaders(customer))
      .send({ bookingId, rating: 4, comment: 'Trying again' });
    expect(duplicate.status).toBe(409);

    // The published review is visible on the public listing page.
    const publicReviews = await request(app).get(`/api/v1/catalog/listings/${slug}/reviews`);
    expect(publicReviews.status).toBe(200);
    expect(publicReviews.body.data.items).toHaveLength(1);
    expect(publicReviews.body.data.average).toBe(5);
  });

  it('lets the partner respond to a published review', async () => {
    const { bookingId } = await completedBooking('Partner response warehouse');
    const created = await request(app)
      .post('/api/v1/reviews')
      .set(authHeaders(customer))
      .send({ bookingId, rating: 4, comment: 'Good overall, minor delays.' });
    expect(created.status).toBe(201);

    const respond = await request(app)
      .post(`/api/v1/reviews/${created.body.data.id}/respond`)
      .set(authHeaders(partner))
      .send({ text: 'Thanks for the feedback — we added a second crew at the dock.' });
    expect(respond.status).toBe(200);
    expect(respond.body.data.response).toBeTruthy();
  });

  it('prevents a partner from responding to a review twice with the wrong ownership', async () => {
    const { bookingId } = await completedBooking('Ownership guard warehouse');
    const created = await request(app)
      .post('/api/v1/reviews')
      .set(authHeaders(customer))
      .send({ bookingId, rating: 3, comment: 'Average experience this time.' });
    expect(created.status).toBe(201);

    // A different (unrelated) partner cannot respond.
    const otherPartner = await registerVerifiedPartner('Unrelated Partner');
    const res = await request(app)
      .post(`/api/v1/reviews/${created.body.data.id}/respond`)
      .set(authHeaders(otherPartner))
      .send({ text: 'We have nothing to do with this listing.' });
    expect(res.status).not.toBe(200);
  });

  it('requires authentication for review creation', async () => {
    const res = await request(app)
      .post('/api/v1/reviews')
      .send({ bookingId: '665f1c2e8f1c2e8f1c2e8f1c', rating: 5 });
    expect(res.status).toBe(401);
  });
});
