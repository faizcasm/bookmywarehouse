import { expect, test } from '@playwright/test';

import {
  APPS,
  DEMO,
  DEMO_PASSWORD,
  apiJson,
  apiListingPayload,
  fetchApiField,
  fillAndSubmitListingForm,
  firstWarehouseCategoryId,
  openApp,
  sessionFromToken,
  tinyPngPath,
  uiAccessToken,
  uniqueEmail,
  uniqueId,
  type UiSession,
} from './helpers';

/**
 * Scenarios 6–7 — administration.
 *
 *   6 — a freshly registered partner submits KYC documents through the partner
 *       profile UI; the admin approves them in the verification queue.
 *   7 — the verified partner@ creates + publishes a listing in the partner UI,
 *       the admin approves it (and rejects a second one) in the admin console.
 *
 * The fresh partner is created per run so the test is repeatable (the seeded
 * partner2 is already SUBMITTED/VERIFIED after the first run).
 */
test.describe.serial('Scenarios 6-7: admin verification and listing moderation', () => {
  const freshEmail = uniqueEmail('newpartner');
  const freshBusiness = `E2E Warehouse Ops ${uniqueId()}`;

  let admin: UiSession;
  let partner: UiSession;
  let freshPartner: UiSession;

  test.beforeAll(async ({ browser }) => {
    admin = await openApp(browser, 'admin', DEMO.admin);
    partner = await openApp(browser, 'partner', DEMO.partner);

    // Setup: register the partner through the partner console UI (one
    // rate-limited auth call — registration also signs the session in and
    // lands on /onboarding, where the KYC documents are submitted below).
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${APPS.partner}/register`);
    await expect(page.locator('#reg-email')).toBeVisible();
    await page.locator('#reg-name').fill('E2E New Partner');
    await page.locator('#reg-email').fill(freshEmail);
    await page.locator('#reg-password').fill(DEMO_PASSWORD);
    await page.locator('#reg-business').fill(freshBusiness);
    await page.locator('form:has(#reg-password) button[type="submit"]').click();
    await expect(page, 'registering should land the partner on onboarding').toHaveURL(/\/onboarding/, {
      timeout: 30_000,
    });
    freshPartner = { context, page, email: freshEmail };
  });

  test.afterAll(async () => {
    await admin?.context.close();
    await partner?.context.close();
    await freshPartner?.context.close();
  });

  test('Scenario 6 — a partner submits verification documents and the admin verifies them', async () => {
    // --- Partner: submit KYC documents through the profile UI -----------
    const partnerPage = freshPartner.page;
    await partnerPage.goto(`${APPS.partner}/onboarding`);
    await expect(partnerPage.locator('#kyc-legal-name')).toBeVisible();

    await partnerPage.locator('#kyc-legal-name').fill(freshBusiness);

    const kyc = partnerPage.locator('section.card', { has: partnerPage.locator('#kyc-heading') });
    // NOTE: the business form and the KYC form render the same `addr-*` ids on
    // this page, so every address field is scoped to the KYC section.
    await kyc.locator('#addr-line1').fill('1 E2E Test Street');
    await kyc.locator('#addr-city').fill('Pune');
    await kyc.locator('#addr-state').fill('Maharashtra');
    await kyc.locator('#addr-postal').fill('411001');

    // A fresh profile starts with no document rows.
    await kyc.getByRole('button', { name: '+ Add document' }).click();
    const docRow = kyc.locator('.doc-row').first();
    await expect(docRow).toBeVisible();
    await docRow.locator('.doc-row__label input').fill('GST registration certificate');
    await docRow.locator('input[type="file"]').setInputFiles(tinyPngPath());
    await expect(kyc.locator('.upload-list__item--done').first()).toBeVisible({ timeout: 30_000 });

    await kyc.getByRole('button', { name: 'Submit for review' }).click();
    await expect(partnerPage.getByText('Verification documents submitted for review.')).toBeVisible({
      timeout: 20_000,
    });
    expect(await fetchApiField(partnerPage, '/partner/profile', 'verificationStatus')).toBe('SUBMITTED');

    // --- Admin: approve the submission in the verification queue --------
    const adminPage = admin.page;
    await adminPage.goto(`${APPS.admin}/verification-queue?status=SUBMITTED`);
    const item = adminPage.locator('.queue-item').filter({ hasText: freshEmail });
    await expect(item, 'the new partner must be waiting in the SUBMITTED queue').toBeVisible({
      timeout: 20_000,
    });

    await item.getByRole('button', { name: 'Decide' }).click();
    // The decision dialog opens on "Approve — mark verified".
    await expect(adminPage.getByRole('heading', { name: 'Verification decision' })).toBeVisible();
    await adminPage.getByRole('button', { name: 'Submit decision' }).click();

    await expect(adminPage.locator('.toast__message', { hasText: 'approve recorded.' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(item).toHaveCount(0);
    expect(await fetchApiField(partnerPage, '/partner/profile', 'verificationStatus')).toBe('VERIFIED');
  });

  test('Scenario 7 — the admin approves one listing and rejects another', async () => {
    const approveTitle = `E2E approved warehouse ${uniqueId()}`;
    const rejectTitle = `E2E rejected warehouse ${uniqueId()}`;
    const adminPage = admin.page;

    // --- Partner: create + publish a listing through the partner UI -----
    await fillAndSubmitListingForm(partner.page, approveTitle);

    await partner.page.goto(`${APPS.partner}/listings?q=${encodeURIComponent(approveTitle)}`);
    const partnerRow = partner.page.locator('table.data-table tbody tr').filter({ hasText: approveTitle });
    await expect(partnerRow).toBeVisible();
    await partnerRow.getByRole('button', { name: 'Publish' }).click();
    await partner.page.getByRole('button', { name: 'Submit for review' }).click();
    await expect(partner.page.locator('.toast', { hasText: 'submitted for review' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(partnerRow.locator('.badge[data-status="PENDING_REVIEW"]')).toBeVisible();

    // --- Admin: approve it --------------------------------------------
    await adminPage.goto(
      `${APPS.admin}/listings?status=PENDING_REVIEW&q=${encodeURIComponent(approveTitle)}`,
    );
    const approveCard = adminPage.locator('.listing-card').filter({ hasText: approveTitle });
    await expect(approveCard).toBeVisible({ timeout: 20_000 });
    await approveCard.getByRole('button', { name: 'Approve', exact: true }).click();

    const approveDialog = adminPage.getByRole('dialog');
    await expect(approveDialog).toBeVisible();
    await approveDialog.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(
      adminPage.locator('.toast__message', { hasText: `${approveTitle}: approve recorded.` }),
    ).toBeVisible({ timeout: 20_000 });

    await adminPage.goto(`${APPS.admin}/listings?q=${encodeURIComponent(approveTitle)}`);
    await expect(
      adminPage.locator('.listing-card', { hasText: approveTitle }).getByText('Published', { exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    // --- Second listing: partner submits, admin rejects -----------------
    // Created through the API with the partner UI's own session token (no
    // extra login), then published and rejected through the admin console.
    const categoryId = await firstWarehouseCategoryId();
    const partnerApi = await sessionFromToken(await uiAccessToken(partner.page));
    try {
      const created = await apiJson<{ id: string }>(
        partnerApi,
        'POST',
        '/partner/listings',
        apiListingPayload({ categoryId, title: rejectTitle }),
      );
      await apiJson(partnerApi, 'POST', `/partner/listings/${created.id}/publish`);
    } finally {
      await partnerApi.ctx.dispose();
    }

    await adminPage.goto(
      `${APPS.admin}/listings?status=PENDING_REVIEW&q=${encodeURIComponent(rejectTitle)}`,
    );
    const rejectCard = adminPage.locator('.listing-card').filter({ hasText: rejectTitle });
    await expect(rejectCard).toBeVisible({ timeout: 20_000 });
    await rejectCard.getByRole('button', { name: 'Reject', exact: true }).click();

    const rejectDialog = adminPage.getByRole('dialog');
    await expect(rejectDialog).toBeVisible();
    // A rejection reason is mandatory.
    await rejectDialog.locator('#reason-dialog-input').fill('Goods fire-safety certificate expired.');
    await rejectDialog.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(
      adminPage.locator('.toast__message', { hasText: `${rejectTitle}: reject recorded.` }),
    ).toBeVisible({ timeout: 20_000 });

    await adminPage.goto(`${APPS.admin}/listings?q=${encodeURIComponent(rejectTitle)}`);
    await expect(
      adminPage.locator('.listing-card', { hasText: rejectTitle }).getByText('Rejected', { exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    // The partner console shows the same outcome to the owner.
    await partner.page.goto(`${APPS.partner}/listings?q=${encodeURIComponent(rejectTitle)}`);
    await expect(
      partner.page
        .locator('table.data-table tbody tr')
        .filter({ hasText: rejectTitle })
        .locator('.badge[data-status="REJECTED"]'),
    ).toBeVisible({ timeout: 20_000 });
  });
});
