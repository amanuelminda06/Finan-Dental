import { test, expect } from '@playwright/test';
import { login, loginUrl, tenantUrl } from './helpers';

test.describe('smoke', () => {
  test('owner signs in and lands on the dashboard', async ({ page }) => {
    await login(page, 'OWNER');
    await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible();
  });

  test('wrong password is rejected', async ({ page }) => {
    await page.goto(loginUrl());
    await page.fill('#email', 'owner');
    await page.fill('#password', 'definitely-wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Next's route announcer is also role="alert"; scope to the form.
    await expect(page.locator('form [role="alert"]')).toContainText(/incorrect/i);
  });

  test('unknown login path 404s', async ({ page }) => {
    const response = await page.goto(tenantUrl('/login/not-the-secret'));
    expect(response?.status()).toBe(404);
  });
});
