import { expect, test } from '@playwright/test';

import { APPS, DEMO, openApp, uniqueEmail } from './helpers';

/**
 * Scenario 1 — A customer registers and searches for a warehouse.
 * Registration goes through the real UI form; the search runs on the customer
 * home page and lands on /search with live results.
 */
test.describe('Scenario 1: customer registers and searches', () => {
  test('Scenario 1 — a new customer can register and then search for a warehouse', async ({
    page,
  }) => {
    const email = uniqueEmail('shopper');

    // --- Register through the UI -------------------------------------
    await page.goto(`${APPS.customer}/register`);
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

    await page.locator('#reg-name').fill('E2E Shopper');
    await page.locator('#reg-email').fill(email);
    await page.locator('#reg-password').fill('Password1');
    await page.locator('#reg-confirm').fill('Password1');
    await page.getByRole('button', { name: 'Create account' }).click();

    // Landed back on the marketplace as an authenticated visitor.
    await expect(page).toHaveURL(`${APPS.customer}/`, { timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    await expect(page.getByText('Account created — welcome aboard!')).toBeVisible();

    // --- Search for a warehouse --------------------------------------
    // Use a keyword unique to the seeded listing ("Pune general warehouse
    // with 4 loading docks") — generic terms like "warehouse" match the
    // listings previous E2E runs leave behind and are order-dependent.
    await page.locator('#hero-keyword').fill('4 loading docks');
    await page.locator('#hero-city').fill('Pune');
    await page.locator('.hero-search').getByRole('button', { name: 'Search' }).click();

    await expect(page).toHaveURL(/\/search\?/);
    await expect(page.getByText('Results for')).toBeVisible();
    await expect(page.locator('.grid-cards a[href^="/listing/"]').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Pune general warehouse/i }).first()).toBeVisible();
  });

  test('Scenario 1 (support) — the seeded demo customer can sign in', async ({ browser }) => {
    // Cheap sanity check that UI login works before the booking scenarios
    // depend on it; also populates the cached session for later files.
    const session = await openApp(browser, 'customer', DEMO.customer);
    await session.page.goto(`${APPS.customer}/`);
    await expect(session.page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    await session.context.close();
  });
});
