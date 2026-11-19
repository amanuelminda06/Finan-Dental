import { test, expect } from '@playwright/test';
import { appUrl, login } from './helpers';

/**
 * Clinical Data Management (CDM, doctors and owners): free text is always
 * accepted, alerts show every allergy, tooth mentions link to the odontogram,
 * and custom plan items save.
 *
 * Reception creates the patient first because the CDM role cannot use patient admin.
 */
test.describe('clinical data management', () => {
  test('records free-text history, findings, a linked visit and a custom plan item', async ({
    page,
  }) => {
    const stamp = Date.now().toString().slice(-8);
    const fullName = `Clinical E2E ${stamp}`;
    const phone = `09${stamp}`;
    const allergy = `E2E allergy ${stamp}`;
    const finding = `E2E finding ${stamp}`;
    const procedure = `E2E procedure ${stamp}`;

    await test.step('reception creates a patient', async () => {
      await login(page, 'RECEPTION');
      await page.goto(appUrl('/patients/new'));
      await page.fill('#fullName', fullName);
      await page.fill('#phone', phone);
      await page.getByRole('button', { name: 'Create patient' }).click();
      await expect(page.getByRole('heading', { name: fullName })).toBeVisible({ timeout: 15_000 });
    });

    const patientId = new URL(page.url()).pathname.split('/').pop();
    if (!patientId) throw new Error('No patient id after creation');

    await test.step('doctor opens the chart', async () => {
      await login(page, 'STAFF');
      await page.goto(appUrl(`/clinical/${patientId}`));
      await expect(
        page.getByRole('heading', { name: `CDM chart: ${fullName}` }),
      ).toBeVisible();
      await expect(page.getByText('No medical alerts recorded.')).toBeVisible();
    });

    await test.step('a typed allergy is saved and shown in the alert banner', async () => {
      const profileForm = page.locator('form:has(#clinical-allergies)');
      await profileForm.locator('#clinical-allergies').fill(allergy);
      await profileForm.locator('#clinical-allergies').press('Enter');
      await expect(profileForm.getByText(allergy)).toBeVisible();
      await profileForm.getByRole('button', { name: 'Save', exact: true }).click();

      const alerts = page.getByRole('region', { name: 'Medical alerts' });
      await expect(alerts).toContainText(allergy);
    });

    await test.step('a typed tooth finding is saved on tooth 36', async () => {
      await page.locator('#tooth-36').click();
      const toothForm = page.locator('form:has(#clinical-tooth-finding)');
      await toothForm.locator('#clinical-tooth-finding').fill(finding);
      await toothForm.locator('#clinical-tooth-note').fill('E2E tooth note');
      await toothForm.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(toothForm.getByText('Custom', { exact: true })).toBeVisible();
      await expect(toothForm.locator('#clinical-tooth-note')).toHaveValue('E2E tooth note');
    });

    await test.step('a visit note with #36 links to that tooth', async () => {
      await page.locator('#clinical-visit-body').fill(`Review pain in #36. ${finding}`);
      await page.getByRole('button', { name: 'Add visit' }).click();
      await expect(page.locator('a[href="#tooth-36"]').first()).toBeVisible();
      await expect(page.getByText(`Review pain in #36. ${finding}`)).toBeVisible();
    });

    await test.step('a custom plan item with a manual price is saved', async () => {
      const planForm = page.locator('form:has(#clinical-plan-procedure)');
      await planForm.locator('#clinical-plan-procedure').fill(procedure);
      await planForm.locator('#clinical-plan-price').fill('123.45');
      await planForm.locator('#clinical-plan-tooth').selectOption('36');
      await planForm.getByRole('button', { name: 'Add to plan' }).click();
      await expect(page.getByText(procedure).first()).toBeVisible();
      await expect(page.getByText('123.45').first()).toBeVisible();
    });

    await test.step('the custom plan item can be invoiced and opened as a receipt', async () => {
      const row = page.locator('li').filter({ hasText: procedure });
      await row.getByRole('button', { name: 'Invoice' }).click();
      const receipt = row.getByRole('link', { name: 'Receipt' });
      await expect(receipt).toBeVisible({ timeout: 15_000 });
      await receipt.click();
      await expect(page).toHaveURL(/\/clinical\/receipts\//);
      await expect(page.getByText(procedure)).toBeVisible();
      await page.getByRole('link', { name: 'Back to chart' }).click();
      await expect(page).toHaveURL(/\/clinical\/[^/]+$/);
    });

    await test.step('chart search finds the typed allergy', async () => {
      await page.locator('#clinical-chart-search').fill(allergy);
      await page.getByRole('button', { name: 'Search chart' }).click();
      await expect(page.getByText('Matching chart text')).toBeVisible();
      await expect(page.getByText(allergy, { exact: false }).last()).toBeVisible();
    });

    await test.step('the printable plan shows the custom procedure', async () => {
      await page.getByRole('link', { name: 'Print plan' }).click();
      await expect(page).toHaveURL(/\/plan\/print$/);
      await expect(page.getByText(procedure)).toBeVisible();
    });
  });
});
