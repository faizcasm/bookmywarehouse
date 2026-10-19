import { expect, test } from '@playwright/test';

import { APPS, DEMO, apiCall, apiLogin, apiUrl, publicApi } from './helpers';

/**
 * Scenario 8 — unauthorized users cannot access protected records.
 *
 * Covered at both layers:
 *  - UI: logged-out visitors are bounced to /login on all three apps, and a
 *    *valid* customer token injected into the admin app is still rejected by
 *    the role guard (the admin API answers 200 to /auth/me, then the console
 *    refuses to render).
 *  - API: anonymous → 401, authenticated-but-wrong-role → 403.
 */
test.describe('Scenario 8: unauthorized access is blocked', () => {
  test('Scenario 8 — logged-out visitors are redirected from protected pages', async ({
    browser,
  }) => {
    const targets = [
      { app: 'customer', path: '/bookings' },
      { app: 'partner', path: '/listings' },
      { app: 'admin', path: '/listings' },
    ] as const;

    for (const target of targets) {
      const context = await browser.newContext(); // deliberately no storage state
      const page = await context.newPage();
      await page.goto(`${APPS[target.app]}${target.path}`);
      await expect(
        page,
        `${target.app} ${target.path} must not render for an anonymous visitor`,
      ).toHaveURL(/\/login/);
      await expect(page.locator('#login-email')).toBeVisible();
      await context.close();
    }
  });

  test('Scenario 8 — a valid customer session cannot reach admin-only records', async ({
    browser,
  }) => {
    const customer = await apiLogin(DEMO.customer);

    try {
      // --- UI: inject the customer's token into the admin console --------
      const context = await browser.newContext();
      await context.addInitScript(
        (token) => window.localStorage.setItem('bmw_access_token', token),
        customer.token,
      );
      const page = await context.newPage();

      const meResponse = page.waitForResponse(
        (res) => new URL(res.url()).pathname.endsWith('/auth/me') && res.request().method() === 'GET',
      );
      await page.goto(`${APPS.admin}/listings`);
      const me = await meResponse;
      expect(me.status(), 'the admin app boots the session with GET /auth/me').toBe(200);

      // Session is valid, but the role guard still refuses to render admin UI.
      await expect(page, 'a CUSTOMER token must never render the admin console').toHaveURL(
        /\/login/,
      );
      await context.close();

      // --- API: admin records are denied -------------------------------
      const anonymous = await publicApi();
      const unauthenticated = await anonymous.get(apiUrl('/admin/users'));
      expect(unauthenticated.status()).toBe(401);
      const unauthBody = await unauthenticated.json();
      expect(unauthBody?.error?.code).toBe('UNAUTHENTICATED');

      const { res: forbidden, body: forbiddenBody } = await apiCall(customer, 'GET', '/admin/users');
      expect(forbidden.status()).toBe(403);
      expect(forbiddenBody.error?.code).toBe('FORBIDDEN');

      // Partner-scoped records reject other roles too.
      const { res: partnerDenied } = await apiCall(customer, 'GET', '/partner/profile');
      expect(partnerDenied.status()).toBe(403);

      await anonymous.dispose();
    } finally {
      await customer.ctx.dispose();
    }
  });
});
