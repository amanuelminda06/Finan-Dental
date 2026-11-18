import { test, expect } from '@playwright/test';

/**
 * The platform login is tenant-independent: `/` sends visitors to
 * `/superadmin`, which shows this login when signed out and the dashboard when
 * signed in. These credentials are deliberately fixed by product requirement.
 */
test.describe('superadmin platform login', () => {
  test('root redirects to the platform login', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/superadmin\/?$/);
    await expect(page.getByRole('heading', { name: 'Superadmin sign in' })).toBeVisible();
  });

  test('wrong platform password is rejected', async ({ page }) => {
    await page.goto('/superadmin');
    await page.fill('#superadmin-username', 'Aman');
    await page.fill('#superadmin-password', 'definitely-wrong');
    await page.getByRole('button', { name: 'Platform sign in' }).click();
    await expect(page.locator('form [role="alert"]')).toContainText(/invalid/i);
  });

  test('platform login opens the tenant management dashboard', async ({ page }) => {
    await page.goto('/superadmin');
    await page.fill('#superadmin-username', 'Aman');
    await page.fill('#superadmin-password', '2906');
    await page.getByRole('button', { name: 'Platform sign in' }).click();

    await expect(page.getByRole('heading', { name: 'Superadmin dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create a tenant' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage' }).first()).toBeVisible();
  });
});
