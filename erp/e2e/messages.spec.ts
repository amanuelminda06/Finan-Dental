import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('messages workspace', () => {
  test('owner opens the message list, templates, and campaigns', async ({ page }) => {
    await login(page, 'OWNER');

    await page.goto('/messages');
    await expect(page.getByRole('heading', { name: "Today's Messages" })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New message' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Templates' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Campaigns' })).toBeVisible();

    await page.getByRole('link', { name: 'Templates' }).click();
    await expect(page).toHaveURL(/\/messages\/templates/);
    await expect(page.getByRole('heading', { name: /templates/i })).toBeVisible();
  });
});
