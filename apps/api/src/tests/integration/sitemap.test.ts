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
  registerVerifiedPartner,
  wipeTestDb,
  type TestUser,
} from '../helpers.js';
import { env } from '../../config/env.js';

describe('public sitemap.xml and robots.txt', () => {
  let partner: TestUser;
  let admin: TestUser;
  let publishedSlug: string;
  let draftSlug: string;

  beforeAll(async () => {
    await initTestDb();
    await wipeTestDb();
    partner = await registerVerifiedPartner('Sitemap Test Partner');
    admin = await registerAdmin();
    const categoryId = (await createTestCategory('WAREHOUSE', 'Sitemap warehouse')).id;

    // Published listing: submit for review, then admin approval moves it to PUBLISHED.
    const published = await createPartnerListing(partner, {
      categoryId,
      title: 'Published sitemap warehouse',
    });
    publishedSlug = published.slug;
    const submit = await request(app)
      .post(`/api/v1/partner/listings/${published.id}/publish`)
      .set(authHeaders(partner));
    expect(submit.status).toBe(200);
    const approve = await request(app)
      .patch(`/api/v1/admin/listings/${published.id}`)
      .set(authHeaders(admin))
      .send({ decision: 'APPROVE' });
    expect(approve.status).toBe(200);

    // Draft listing: never submitted, must never leak into the sitemap.
    const draft = await createPartnerListing(partner, {
      categoryId,
      title: 'Draft sitemap warehouse',
    });
    draftSlug = draft.slug;
    expect(draft.status).toBe('DRAFT');
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('serves /api/sitemap.xml without auth with home + published listing URLs', async () => {
    const res = await request(app).get('/api/sitemap.xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(res.text).toContain('<urlset');
    expect(res.text).toContain(`<loc>${env.CUSTOMER_APP_URL}/</loc>`);
    expect(res.text).toContain(`<loc>${env.CUSTOMER_APP_URL}/search</loc>`);
    expect(res.text).toContain(
      `<loc>${env.CUSTOMER_APP_URL}/listing/${publishedSlug}</loc>`,
    );
    // Listings carry a lastmod + weekly cadence.
    expect(res.text).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T[^<]+<\/lastmod>/);
    expect(res.text).toContain('<changefreq>weekly</changefreq>');
  });

  it('excludes draft/unpublished listings from the sitemap', async () => {
    const res = await request(app).get('/api/sitemap.xml');

    expect(res.status).toBe(200);
    expect(res.text).not.toContain(draftSlug);
  });

  it('answers at the root path /sitemap.xml too', async () => {
    const res = await request(app).get('/sitemap.xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain(`<loc>${env.CUSTOMER_APP_URL}/listing/${publishedSlug}</loc>`);
  });

  it('serves /api/robots.txt without auth and points at the sitemap', async () => {
    const res = await request(app).get('/api/robots.txt');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('User-agent: *');
    expect(res.text).toContain('Disallow: /admin/');
    expect(res.text).toContain('Disallow: /partner/');
    expect(res.text).toContain(`Sitemap: ${env.CUSTOMER_APP_URL}/api/sitemap.xml`);
  });
});
