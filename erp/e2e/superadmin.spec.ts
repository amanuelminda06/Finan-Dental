import { test, expect, type Page } from '@playwright/test';

async function signInToPlatform(page: Page): Promise<void> {
  await page.goto('/superadmin');
  await page.fill('#superadmin-username', 'Aman');
  await page.fill('#superadmin-password', '2906');
  await page.getByRole('button', { name: 'Platform sign in' }).click();
}

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
    await signInToPlatform(page);

    await expect(page.getByRole('heading', { name: 'Superadmin dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create a tenant' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage' }).first()).toBeVisible();
  });
});

test.describe('superadmin tenant provisioning', () => {
  test('creates a temporary tenant and removes it', async ({ page }) => {
    const slug = `qa-${Date.now()}`;
    const name = 'QA Temporary Clinic';
    let created = false;
    let removed = false;

    await signInToPlatform(page);
    try {
      await page.fill('#new-tenant-slug', slug);
      await page.fill('#new-tenant-name', name);
      await page.fill('#new-tenant-email', `${slug}@example.com`);
      await page.getByRole('button', { name: 'Create tenant', exact: true }).click();

      await expect(page).toHaveURL(new RegExp(`/superadmin/tenants/${slug}/?$`));
      created = true;
      await expect(page.getByRole('heading', { name })).toBeVisible();
      await expect(page.getByText(`/${slug}`, { exact: true })).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Delete tenant' }).click();
      removed = true;
      await expect(page).toHaveURL(/\/superadmin\/?$/);
      await expect(page.locator('tr', { hasText: `/${slug}` })).toHaveCount(0);
    } finally {
      if (created && !removed) {
        page.once('dialog', (dialog) => dialog.accept());
        await page.goto(`/superadmin/tenants/${slug}`);
        const button = page.getByRole('button', { name: 'Delete tenant' });
        if (await button.count()) {
          await button.click();
          await page.waitForURL(/\/superadmin\/?$/);
        }
      }
    }
  });
});
