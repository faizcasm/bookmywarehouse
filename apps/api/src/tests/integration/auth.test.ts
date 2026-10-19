import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../helpers.js';
import { closeTestDb, initTestDb, registerAdmin, registerUser, wipeTestDb } from '../helpers.js';

describe('auth flows', () => {
  beforeAll(async () => {
    await initTestDb();
    await wipeTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('registers a customer and returns tokens + CSRF cookie', async () => {
    const user = await registerUser();
    expect(user.role).toBe('CUSTOMER');
    expect(user.token.length).toBeGreaterThan(50);
    expect(user.csrfToken.length).toBeGreaterThan(10);
    expect(user.cookies.join(';')).toContain('bmw_csrf');
    expect(user.cookies.join(';')).toContain('bmw_rt');
  });

  it('rejects duplicate registration with EMAIL_TAKEN', async () => {
    const user = await registerUser();
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Impostor',
      email: user.email,
      password: 'Password1',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects invalid credentials', async () => {
    const user = await registerUser();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in and exposes the session on /auth/me', async () => {
    const user = await registerUser();
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Password1' });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(user.email);
  });

  it('requires authentication for protected routes', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects garbage access tokens', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer nonsense');
    expect(res.status).toBe(401);
  });

  it('rotates the refresh token only with a valid CSRF header', async () => {
    const user = await registerUser();

    // Without the double-submit header → blocked.
    const blocked = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', user.cookies)
      .send({});
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('FORBIDDEN');

    // With matching header → new access token.
    const ok = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', user.cookies)
      .set('X-CSRF-Token', user.csrfToken)
      .send({});
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toBeTruthy();
  });

  it('enforces role-based authorization on admin routes', async () => {
    const customer = await registerUser();
    const admin = await registerAdmin();

    const denied = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${customer.token}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const allowed = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.totals).toBeTruthy();
  });

  it('blocks customers from partner routes', async () => {
    const customer = await registerUser();
    const res = await request(app)
      .get('/api/v1/partner/dashboard')
      .set('Authorization', `Bearer ${customer.token}`);
    expect(res.status).toBe(403);
  });

  it('logs out and invalidates the refresh cookie', async () => {
    const user = await registerUser();
    const out = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', user.cookies)
      .set('X-CSRF-Token', user.csrfToken)
      .send({});
    expect(out.status).toBe(200);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', user.cookies)
      .set('X-CSRF-Token', user.csrfToken)
      .send({});
    expect(refresh.status).toBeGreaterThanOrEqual(400);
  });

  it('validates request bodies with field-level errors', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'nope' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.issues)).toBe(true);
  });
});
