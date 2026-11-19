import { test, expect } from '@playwright/test';
import { appUrl, login, expectForbidden } from './helpers';

test.describe('role-based access', () => {
  test('owner sees the revenue link', async ({ page }) => {
    await login(page, 'OWNER');
    await expect(page.getByRole('link', { name: 'Revenue' }).first()).toBeVisible();
  });

  test('reception has no revenue link and is redirected from /revenue', async ({ page }) => {
    await login(page, 'RECEPTION');
    await expect(page.getByRole('link', { name: 'Revenue' })).toHaveCount(0);
    await expectForbidden(page, '/revenue');
  });

  test('staff cannot open patient records', async ({ page }) => {
    await login(page, 'STAFF');
    await expectForbidden(page, '/patients');
  });

  test('staff sees clinical charts and can open them', async ({ page }) => {
    await login(page, 'STAFF');
    await expect(page.getByRole('link', { name: 'Clinical charts' }).first()).toBeVisible();
    await page.goto(appUrl('/clinical'));
    await expect(page).toHaveURL(/\/clinical/);
    await expect(page.getByRole('heading', { name: 'Clinical charts' })).toBeVisible();
  });

  test('non-doctors cannot open clinical charts', async ({ page }) => {
    await login(page, 'OWNER');
    await expectForbidden(page, '/clinical');
    await login(page, 'RECEPTION');
    await expectForbidden(page, '/clinical');
  });
});
