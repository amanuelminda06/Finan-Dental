import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { login } from './helpers';

/**
 * Captures the screenshots used by docs/manual (PMS, CMS, MMS).
 *
 * Run against a seeded dev/production server with OWNER credentials in .env:
 *   npx playwright test e2e/manual-screenshots.spec.ts
 *
 * The run creates a demo patient, a demo sale and a demo service (only when
 * missing), and sends a two-recipient message, so screenshots show populated
 * screens. Re-running reuses the demo patient/service.
 */

const OUT = join('docs', 'manual', 'screenshots');
const DEMO_PATIENT = 'Abebe Tesfaye (Manual Demo)';
const DEMO_PHONE = '0911778899';
const DEMO_SERVICE = 'Manual Demo Service';

mkdirSync(OUT, { recursive: true });

async function shot(page: Page, name: string, fullPage = true) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(200);
}

test('capture PMS, CMS and MMS screenshots', async ({ page }) => {
  test.setTimeout(600_000);
  await page.setDefaultTimeout(15_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  // `Send` buttons are real sms: links — keep the browser from leaving the app.
  await page.route('sms:**', (route) => route.abort()).catch(() => undefined);

  await login(page, 'OWNER');

  /* ------------------------------------------------------------------ PMS */
  await test.step('PMS · patients list', async () => {
    await page.goto('/patients');
    await settle(page);
    await shot(page, 'pms-01-patients-list');

    await page.fill('#q', 'Demo');
    await page.getByRole('button', { name: 'Filter' }).click();
    await settle(page);
    await shot(page, 'pms-02-patients-search');

    await page.goto('/patients?status=INACTIVE');
    await settle(page);
    await shot(page, 'pms-03-patients-filtered');

    await page.getByRole('link', { name: 'Clear' }).click();
    await settle(page);
  });

  let patientId = '';
  await test.step('PMS · create patient', async () => {
    await page.goto('/patients?q=' + encodeURIComponent(DEMO_PHONE));
    await settle(page);
    const existing = page.getByRole('link', { name: DEMO_PATIENT }).first();
    if (await existing.count()) {
      patientId = (await existing.getAttribute('href'))?.split('/').pop() ?? '';
    }

    await page.goto('/patients/new');
    await settle(page);
    await shot(page, 'pms-04-patient-form-empty');

    await page.fill('#fullName', DEMO_PATIENT);
    await page.fill('#phone', DEMO_PHONE);
    await page.selectOption('#sex', 'FEMALE');
    await page.fill('#age', '34');
    await page.selectOption('#preferredLanguage', 'en');
    await page.fill(
      '#notesNonClinical',
      'Manual demo patient created while writing the operations manual. Safe to deactivate.',
    );
    await shot(page, 'pms-05-patient-form-filled');

    if (!patientId) {
      await page.getByRole('button', { name: 'Create patient' }).click();
      // Land on the detail page — not on /patients/new itself.
      await page.waitForURL((url) => /^\/patients\/[^/]+$/.test(url.pathname), {
        timeout: 20_000,
      });
      patientId = new URL(page.url()).pathname.split('/').pop() ?? '';
    }

    await page.goto(`/patients/${patientId}`);
    await settle(page);
    await shot(page, 'pms-06-patient-detail');
  });

  await test.step('PMS · edit patient', async () => {
    await page.goto(`/patients/${patientId}/edit`);
    await settle(page);
    await shot(page, 'pms-07-patient-edit');

    const notes = page.locator('#notesNonClinical');
    await notes.fill(
      'Manual demo patient created while writing the operations manual. Safe to deactivate.\nUpdated during the manual screen capture.',
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('/edit'), { timeout: 20_000 });
    await settle(page);
    await shot(page, 'pms-08-patient-updated');
  });

  /* ------- CMS · priced service first, so the demo sale has a price ------ */
  await test.step('CMS · create service', async () => {
    await page.goto('/dashboard/services?q=' + encodeURIComponent(DEMO_SERVICE));
    await settle(page);
    const alreadyThere = await page.getByRole('link', { name: 'Edit' }).count();

    if (!alreadyThere) {
      await page.goto('/dashboard/services/new');
      await settle(page);
      await shot(page, 'cms-03-service-form-empty');

      await page.fill('#nameEn', DEMO_SERVICE);
      await page.selectOption('#category', 'OTHER').catch(async () => {
        await page.selectOption('#category', { index: 1 });
      });
      await page.fill('#currentPrice', '250');
      await page.fill('#receiptLabelEn', 'Demo service');
      await page.fill('#displayOrder', '99');
      await page.fill(
        '#publicDescriptionEn',
        'Manual demo service created while writing the operations manual.',
      );
      await shot(page, 'cms-04-service-form-filled');

      await page.getByRole('button', { name: /create service/i }).click();
      await settle(page);
    }

    await page.goto('/dashboard/services?q=' + encodeURIComponent(DEMO_SERVICE));
    await settle(page);
    await shot(page, 'cms-05-service-created');
  });

  let saleId = '';
  await test.step('PMS · record a sale', async () => {
    await page.goto('/sales');
    await settle(page);
    await shot(page, 'pms-09-sales-list');

    await page.goto('/sales/new');
    await settle(page);
    await shot(page, 'pms-10-sale-new-empty');

    await page.getByPlaceholder('Search by name or phone').fill('Abebe');
    await page.waitForTimeout(800);
    await page
      .getByRole('button', { name: new RegExp(DEMO_PATIENT.replace(/[()]/g, '\\$&')) })
      .first()
      .click();
    await settle(page);
    await shot(page, 'pms-11-sale-patient-selected');

    const serviceInput = page.getByPlaceholder('Type a service, press Enter to add');
    await serviceInput.fill('Manual Demo');
    await page.waitForTimeout(400);
    await serviceInput.press('Enter');
    await serviceInput.fill('Consultation');
    await page.waitForTimeout(400);
    await serviceInput.press('Enter');
    await settle(page);
    await shot(page, 'pms-12-sale-services-added');

    await page.selectOption('#doctorId', { index: 1 });
    await page.selectOption('#paymentMethod', 'CASH');
    await settle(page);
    await shot(page, 'pms-13-sale-doctor-and-payment');

    await page.getByRole('button', { name: 'Confirm sale' }).click();
    await page.waitForURL((url) => /^\/sales\/[^/]+$/.test(url.pathname), {
      timeout: 20_000,
    });
    saleId = new URL(page.url()).pathname.split('/').pop() ?? '';
    await settle(page);
    await shot(page, 'pms-14-sale-receipt');
  });

  await test.step('PMS · sales list, revenue, follow-ups, import', async () => {
    await page.goto('/sales');
    await settle(page);
    await shot(page, 'pms-15-sales-list-with-sale');

    await page.goto(`/sales/${saleId}`);
    await settle(page);
    await shot(page, 'pms-16-sale-detail');

    await page.goto('/revenue');
    await settle(page);
    await shot(page, 'pms-17-revenue');

    await page.goto('/follow-ups');
    await settle(page);
    await shot(page, 'pms-18-follow-ups');

    await page.goto('/patients/import');
    await settle(page);
    await shot(page, 'pms-19-patient-import');
  });

  /* ------------------------------------------------------------------ CMS */
  await test.step('CMS · services list and price history', async () => {
    await page.goto('/dashboard/services');
    await settle(page);
    await shot(page, 'cms-01-services-list');

    await page.getByRole('button', { name: 'Price history' }).first().click();
    await settle(page);
    await shot(page, 'cms-02-price-history', false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  await test.step('CMS · edit service', async () => {
    await page.goto('/dashboard/services?q=' + encodeURIComponent(DEMO_SERVICE));
    await settle(page);
    await page.getByRole('link', { name: 'Edit' }).first().click();
    await settle(page);
    await shot(page, 'cms-06-service-edit');
  });

  await test.step('CMS · settings', async () => {
    await page.goto('/settings');
    await settle(page);
    await shot(page, 'cms-07-settings-clinic', false);

    await page.getByRole('heading', { name: 'Working hours' }).scrollIntoViewIfNeeded();
    await shot(page, 'cms-08-settings-working-hours', false);

    await page.getByRole('heading', { name: 'Reminder send time' }).scrollIntoViewIfNeeded();
    await shot(page, 'cms-09-settings-messaging', false);

    await page.getByRole('button', { name: 'Save' }).click();
    await settle(page);
    await shot(page, 'cms-10-settings-saved', false);
  });

  /* ------------------------------------------------------------------ MMS */
  await test.step('MMS · outbox, templates, library', async () => {
    await page.goto('/messages');
    await settle(page);
    await shot(page, 'mms-01-outbox');

    await page.goto('/messages/templates');
    await settle(page);
    await shot(page, 'mms-02-templates');

    await page.goto('/messages/library');
    await settle(page);
    await shot(page, 'mms-03-library');
  });

  await test.step('MMS · compose a message', async () => {
    await page.goto('/messages/new');
    await settle(page);
    await shot(page, 'mms-04-compose-empty');

    // Step 1 — audience: search, then add two patients by hand.
    const searchBox = page.getByPlaceholder('Search patients…');
    const searchButton = page.getByRole('button', { name: 'Search', exact: true });

    await searchBox.fill('Abebe');
    await searchButton.click();
    await page.waitForTimeout(800);
    await shot(page, 'mms-05-compose-search');

    const demoRow = page.locator('li', { hasText: DEMO_PATIENT });
    await demoRow.getByRole('button').last().click();
    await searchBox.fill('Demo Patient Eight');
    await searchButton.click();
    await page.waitForTimeout(800);
    await page
      .locator('li', { hasText: 'Demo Patient Eight' })
      .getByRole('button')
      .last()
      .click();
    await page.waitForTimeout(400);
    await shot(page, 'mms-06-compose-recipients');

    // Step 2 — message.
    const templateSelect = page.locator('select', {
      has: page.locator('option', { hasText: 'Appointment reminder (en)' }),
    });
    await templateSelect
      .selectOption({ label: 'Appointment reminder (en)' })
      .catch(() => undefined);
    await page.waitForTimeout(400);
    await shot(page, 'mms-07-compose-template');

    const body = page.locator('textarea').first();
    await body.fill(
      'Hello {name}, this is a manual demo message from {clinic}. Please call us if you would like to move your appointment.',
    );
    await shot(page, 'mms-08-compose-filled');

    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.waitForTimeout(600);
    await shot(page, 'mms-09-compose-confirm', false);

    await page
      .getByRole('button', { name: /send one by one/i })
      .click({ timeout: 5_000 })
      .catch(() => undefined);
    await page.waitForTimeout(800);
    await shot(page, 'mms-10-compose-send-list');

    // Opening the first sms: link marks that recipient sent (browser stays here).
    await page
      .getByRole('link', { name: 'Open SMS app' })
      .first()
      .click({ timeout: 5_000 })
      .catch(() => undefined);
    await page.waitForTimeout(1_000);
    await shot(page, 'mms-11-compose-sent');
  });

  await test.step('MMS · campaigns, drafts, reports', async () => {
    await page.goto('/messages');
    await settle(page);
    await shot(page, 'mms-12-outbox-after-send');

    await page.goto('/messages/campaigns');
    await settle(page);
    await shot(page, 'mms-13-campaigns');

    await page.goto('/messages/drafts');
    await settle(page);
    await shot(page, 'mms-14-drafts');

    await page.goto('/messages/reports');
    await settle(page);
    await shot(page, 'mms-15-reports');
  });

  expect(patientId).not.toBe('');
});
