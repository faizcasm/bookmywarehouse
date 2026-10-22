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
import { AuditLog } from '../../models/index.js';
import { csvField } from '../../services/export.service.js';

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('CSV formula-injection escaping', () => {
  it('neutralises values a spreadsheet would evaluate as a formula', () => {
    // Exported cells contain partner-authored titles and user e-mails; without
    // the prefix, `=cmd|' /C calc'!A0` would execute when the file is opened.
    expect(csvField('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvField('+1+1')).toBe("'+1+1");
    expect(csvField('-1+1')).toBe("'-1+1");
    expect(csvField('@SUM(1)')).toBe("'@SUM(1)");
  });

  it('leaves ordinary values untouched and keeps RFC 4180 quoting', () => {
    expect(csvField('Bulk, "Prime" warehouse')).toBe('"Bulk, ""Prime"" warehouse"');
    expect(csvField('plain value')).toBe('plain value');
    expect(csvField(null)).toBe('');
    expect(csvField(1250)).toBe('1250');
  });
});

const BOOKINGS_HEADER =
  'reference,customer_email,partner_business,listing_title,status,currency,total_amount,start_date,end_date,created_at';
const PAYOUTS_HEADER = 'reference,partner_business,partner_email,amount,currency,status,created_at';

describe('admin CSV exports (accounting)', () => {
  let partner: TestUser;
  let customer: TestUser;
  let admin: TestUser;
  let categoryId: string;
  let confirmedBooking: { id: string; reference: string };

  beforeAll(async () => {
    await initTestDb();
    await wipeTestDb();
    partner = await registerVerifiedPartner('CSV Export Partner');
    customer = await registerUser();
    admin = await registerAdmin();
    categoryId = (await createTestCategory('WAREHOUSE', 'Export warehouse')).id;

    // Listing title deliberately contains a comma and quotes to exercise RFC 4180 escaping.
    const listing = await createPartnerListing(partner, {
      categoryId,
      title: 'Bulk, "Prime" warehouse',
    });
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
    const reference = created.body.data.reference as string;

    const accept = await request(app)
      .post(`/api/v1/bookings/${bookingId}/accept`)
      .set(authHeaders(partner));
    expect(accept.body.data.status).toBe('AWAITING_PAYMENT');

    // Pay the booking so it becomes CONFIRMED (payout-eligible).
    const intent = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/initiate`)
      .set(authHeaders(customer));
    expect(intent.status).toBe(200);
    const sim = await request(app)
      .post('/api/v1/payments/simulate')
      .set(authHeaders(customer))
      .send({ paymentId: intent.body.data.payment.id, outcome: 'SUCCESS' });
    expect(sim.status).toBe(200);

    confirmedBooking = { id: bookingId, reference };
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('blocks anonymous and non-admin callers', async () => {
    const anonymousBookings = await request(app).get('/api/v1/admin/exports/bookings.csv');
    expect(anonymousBookings.status).toBe(401);

    const partnerBookings = await request(app)
      .get('/api/v1/admin/exports/bookings.csv')
      .set(authHeaders(partner));
    expect(partnerBookings.status).toBe(403);

    const partnerPayouts = await request(app)
      .get('/api/v1/admin/exports/payouts.csv')
      .set(authHeaders(partner));
    expect(partnerPayouts.status).toBe(403);
  });

  it('exports bookings as an escaped UTF-8 CSV attachment', async () => {
    const res = await request(app)
      .get('/api/v1/admin/exports/bookings.csv')
      .set(authHeaders(admin));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-type']).toContain('charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="bmw-bookings-\d{4}-\d{2}-\d{2}\.csv"$/,
    );

    // UTF-8 BOM prefix for Excel.
    expect(res.text.charCodeAt(0)).toBe(0xfeff);

    const [headerRow] = res.text.slice(1).split('\r\n');
    expect(headerRow).toBe(BOOKINGS_HEADER);

    // The comma/quote title must be quoted with doubled embedded quotes.
    expect(res.text).toContain('"Bulk, ""Prime"" warehouse"');
    expect(res.text).toContain(customer.email);
    expect(res.text).toContain('CSV Export Partner');
    expect(res.text).toContain(confirmedBooking.reference);
  });

  it('exports payouts derived from payout-eligible bookings', async () => {
    const res = await request(app)
      .get('/api/v1/admin/exports/payouts.csv')
      .set(authHeaders(admin));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="bmw-payouts-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.text.charCodeAt(0)).toBe(0xfeff);

    const [headerRow, firstRow] = res.text.slice(1).split('\r\n');
    expect(headerRow).toBe(PAYOUTS_HEADER);
    expect(firstRow).toContain(confirmedBooking.reference);
    expect(firstRow).toContain('CSV Export Partner');
    expect(firstRow).toContain(partner.email);
    // amount column is major units with two decimals
    expect(firstRow).toMatch(/,\d+\.\d{2},INR,CONFIRMED,/);
  });

  it('records an audit entry per export', async () => {
    const bookingsExport = await AuditLog.findOne({ action: 'admin.export', entityId: 'bookings.csv' }).lean();
    expect(bookingsExport).toBeTruthy();
    expect(String(bookingsExport?.actor)).toBe(admin.id);
    expect(bookingsExport?.metadata?.rowCount).toBeGreaterThan(0);

    const payoutsExport = await AuditLog.findOne({ action: 'admin.export', entityId: 'payouts.csv' }).lean();
    expect(payoutsExport).toBeTruthy();
    expect(String(payoutsExport?.actor)).toBe(admin.id);
  });
});
