import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Mock only the sending side; the template renderer stays real.
vi.mock('../../services/email.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/email.service.js')>();
  return { ...actual, sendEmail: vi.fn().mockResolvedValue(undefined) };
});

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
import { sendEmail } from '../../services/email.service.js';
import { buildAbsoluteAppUrl, buildEmailForNotification, escapeHtml } from '../../services/email-templates.js';
import { notify } from '../../services/notification.service.js';
import { Notification } from '../../models/index.js';
import { env } from '../../config/env.js';

const mockedSendEmail = vi.mocked(sendEmail);

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('transactional notification emails', () => {
  let partner: TestUser;
  let customer: TestUser;
  let admin: TestUser;
  let categoryId: string;

  beforeAll(async () => {
    await initTestDb();
    await wipeTestDb();
    partner = await registerVerifiedPartner('Email Test Partner');
    customer = await registerUser();
    admin = await registerAdmin();
    categoryId = (await createTestCategory('WAREHOUSE', 'Emails warehouse')).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Publishes a listing and creates a booking as the customer. */
  async function createBooking(title: string): Promise<string> {
    const listing = await createPartnerListing(partner, { categoryId, title });
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
      .send({ listingId: listing.id, startDate: isoInDays(5), endDate: isoInDays(7), quantity: 1 });
    expect(created.status).toBe(201);
    return created.body.data.id as string;
  }

  it('emails the partner an absolute partner-app link when a booking is requested', async () => {
    const bookingId = await createBooking('Email flow warehouse');

    // Fire-and-forget: poll until the booking email send has been attempted.
    await vi.waitFor(() =>
      expect(
        mockedSendEmail.mock.calls.some((call) => call[0].subject === 'New booking request'),
      ).toBe(true),
    );

    const message = mockedSendEmail.mock.calls.find(
      (call) => call[0].subject === 'New booking request',
    )![0];
    expect(message.to).toBe(partner.email);
    expect(message.subject).toBe('New booking request');
    expect(message.html).toContain(`${env.PARTNER_APP_URL}/partner/bookings/${bookingId}`);
    expect(message.html).not.toContain(env.CUSTOMER_APP_URL);
    expect(message.text).toContain('new booking request');
    expect(message.text).toContain('Test User');
    expect(message.text).toContain(`${env.PARTNER_APP_URL}/partner/bookings/${bookingId}`);
  });

  it('does not email for notification types outside the curated map', async () => {
    await notify({
      userId: customer.id,
      type: 'SYSTEM_ANNOUNCEMENT',
      title: 'Scheduled maintenance',
      body: 'The platform will be unavailable tonight.',
      link: '/dashboard',
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('never fails the business flow when sendEmail throws', async () => {
    mockedSendEmail.mockRejectedValueOnce(new Error('email provider down'));

    await expect(
      notify({
        userId: customer.id,
        type: 'PAYMENT_FAILED',
        title: 'Payment failed',
        body: 'Your payment for booking BMW-TEST-1 did not go through.',
        link: '/dashboard/bookings/abc123',
      }),
    ).resolves.toBeUndefined();

    await vi.waitFor(() => expect(mockedSendEmail).toHaveBeenCalled());
    const stored = await Notification.findOne({ user: customer.id, type: 'PAYMENT_FAILED' }).lean();
    expect(stored).toBeTruthy();
  });

  it('maps notification links to the absolute URL of the recipient role', () => {
    expect(buildAbsoluteAppUrl('CUSTOMER', '/dashboard/bookings/1')).toBe(
      `${env.CUSTOMER_APP_URL}/dashboard/bookings/1`,
    );
    expect(buildAbsoluteAppUrl('PARTNER', '/partner/bookings/1')).toBe(
      `${env.PARTNER_APP_URL}/partner/bookings/1`,
    );
    expect(buildAbsoluteAppUrl('ADMIN', '/admin/disputes')).toBe(`${env.ADMIN_APP_URL}/admin/disputes`);
    expect(buildAbsoluteAppUrl('CUSTOMER', null)).toBeNull();
    expect(buildAbsoluteAppUrl('CUSTOMER', 'https://example.com/x')).toBe('https://example.com/x');
  });

  it('builds no email for unmapped types and escapes user-derived text', () => {
    expect(
      buildEmailForNotification(
        { type: 'NEW_MESSAGE', body: 'Hello', link: '/inbox' },
        { email: 'a@b.test', role: 'CUSTOMER' },
      ),
    ).toBeNull();

    const message = buildEmailForNotification(
      {
        type: 'PAYMENT_FAILED',
        body: 'Booking <b>"X"</b> & Co\'s payment failed.',
        link: "/dashboard/bookings/it's",
      },
      { email: 'a@b.test', role: 'CUSTOMER' },
    );
    expect(message).not.toBeNull();
    expect(message!.html).toContain('&lt;b&gt;&quot;X&quot;&lt;/b&gt; &amp; Co&#39;s');
    expect(message!.html).not.toContain('<b>');
    expect(message!.text).toContain('Booking <b>');
  });

  it('escapes the five HTML special characters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
    expect(escapeHtml('plain text')).toBe('plain text');
  });
});
