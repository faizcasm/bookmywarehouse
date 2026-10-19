import { expect, test } from '@playwright/test';

import { APPS, DEMO, bookingWindow, openApp, type UiSession } from './helpers';

/**
 * Scenarios 2–5 share one booking created by the seeded customer on the
 * seeded, published warehouse listing `pune-general-warehouse-midc`
 * (owned by the verified partner@). The four tests run in order:
 *
 *   2 — customer submits the booking request  → PENDING_APPROVAL
 *   3 — partner finds it and accepts          → AWAITING_PAYMENT (accepted)
 *   4 — customer pays (sandbox) → status CONFIRMED visible for both roles
 *   5 — customer can open the booking details page (title + reference)
 */
test.describe.serial('Scenarios 2-5: booking lifecycle', () => {
  const LISTING_SLUG = 'pune-general-warehouse-midc';
  const LISTING_TITLE = 'Pune general warehouse with 4 loading docks';

  let customer: UiSession;
  let partner: UiSession;
  let bookingId = '';
  let reference = '';
  // Jitter the window per run so repeated E2E runs don't stack bookings on
  // the same dates and exhaust the seeded listing's capacity.
  const window = bookingWindow(60 + Math.floor(Math.random() * 25), 3);

  test.beforeAll(async ({ browser }) => {
    customer = await openApp(browser, 'customer', DEMO.customer);
    partner = await openApp(browser, 'partner', DEMO.partner);
  });

  test.afterAll(async () => {
    await customer?.context.close();
    await partner?.context.close();
  });

  test('Scenario 2 — customer submits a booking request (PENDING_APPROVAL)', async () => {
    const page = customer.page;
    await page.goto(`${APPS.customer}/listing/${LISTING_SLUG}`);
    await expect(page.locator('.listing-h1')).toHaveText(new RegExp(LISTING_TITLE, 'i'));

    // Pick an available window (seeded rule: closed on Sundays) + capacity.
    await page.locator('#bk-start').fill(window.start);
    await page.locator('#bk-end').fill(window.end);
    await page.locator('#bk-capacity').fill('10');

    // Live quote must report availability with a total before we can submit.
    await expect(page.locator('.quote-availability .badge.tone-success')).toContainText('Available', {
      timeout: 20_000,
    });
    await expect(page.locator('.quote-total')).toBeVisible();

    await page.getByRole('button', { name: 'Request booking' }).click();

    // Redirects straight to the new booking's detail page.
    await expect(page).toHaveURL(/\/bookings\/[a-z0-9]+/i, { timeout: 30_000 });
    const idMatch = /\/bookings\/([a-z0-9]+)/i.exec(page.url());
    bookingId = idMatch?.[1] ?? '';

    reference = ((await page.locator('.breadcrumbs [aria-current="page"]').textContent()) ?? '').trim();
    expect(reference).toMatch(/^BMW-/);

    await expect(page.locator('.badge[data-status="PENDING_APPROVAL"]')).toBeVisible();
    await expect(page.getByText(LISTING_TITLE).first()).toBeVisible();
  });

  test('Scenario 3 — partner receives the request and accepts it', async () => {
    const page = partner.page;
    await page.goto(`${APPS.partner}/bookings?status=PENDING_APPROVAL`);

    const row = page.locator('table.data-table tbody tr').filter({ hasText: reference });
    await expect(row, 'the new request must appear in the partner queue').toBeVisible();
    await row.getByRole('link', { name: reference }).click();

    await expect(page).toHaveURL(new RegExp(`/bookings/${bookingId}`));
    await expect(page.locator('.badge[data-status="PENDING_APPROVAL"]')).toBeVisible();

    await page.getByRole('button', { name: 'Accept', exact: true }).click();

    // Accepted → the partner is now waiting for the customer's payment.
    await expect(page.locator('.badge[data-status="AWAITING_PAYMENT"]')).toBeVisible({ timeout: 20_000 });
  });

  test('Scenario 4 — booking status reaches CONFIRMED for customer and partner', async () => {
    // Customer completes the sandbox payment.
    const page = customer.page;
    await page.goto(`${APPS.customer}/pay/${bookingId}`);
    await expect(page.locator('.badge[data-status="AWAITING_PAYMENT"]')).toBeVisible();

    await page.getByRole('button', { name: /^Pay\s/ }).click();
    await page.getByRole('button', { name: 'Simulate successful payment' }).click();

    // PayPage polls the API and returns to the booking once confirmed.
    await expect(page).toHaveURL(new RegExp(`/bookings/${bookingId}`), { timeout: 45_000 });
    await expect(page.locator('.badge[data-status="CONFIRMED"]')).toBeVisible();

    // The partner sees the same status.
    const partnerPage = partner.page;
    await partnerPage.goto(`${APPS.partner}/bookings/${bookingId}`);
    await expect(partnerPage.locator('.badge[data-status="CONFIRMED"]')).toBeVisible();
  });

  test('Scenario 5 — customer can access the booking details page', async () => {
    const page = customer.page;
    await page.goto(`${APPS.customer}/bookings/${bookingId}`);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(LISTING_TITLE, 'i'));
    await expect(page.locator('.breadcrumbs [aria-current="page"]')).toHaveText(reference);
    await expect(page.getByRole('heading', { name: 'Status timeline' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Parties' })).toBeVisible();
    await expect(page.getByText('SwiftStow Logistics (Demo)').first()).toBeVisible();
    await expect(page.locator('.summary-total')).toBeVisible();
    await expect(page.locator('.badge[data-status="CONFIRMED"]')).toBeVisible();
  });
});
