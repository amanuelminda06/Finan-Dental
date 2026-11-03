import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { login } from './helpers';

/**
 * Slice 6 group-session E2E (runs on the `mobile` project — the clinic sends
 * from a handset).
 *
 * Picks two known patients in the simple composer, opens the group session,
 * and checks that "Send this batch" is a real `sms:` link that marks the batch
 * sent without any follow-up confirmation.
 */

const SEED = join(process.cwd(), 'prisma', 'seed-group-e2e.ts');

function seedGroup(mode: 'block' | 'allow') {
  execFileSync('npx', ['tsx', SEED, mode], { cwd: process.cwd(), stdio: 'pipe' });
}

async function addPatient(page: import('@playwright/test').Page, name: string) {
  await page.getByPlaceholder('Search patients…').fill(name);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
}

test.describe('group session delivery (mobile)', () => {
  test('group batch opens a sms link and is marked sent automatically', async ({ page }) => {
    seedGroup('allow');
    await login(page, 'OWNER');

    await page.goto('/messages/new');
    await addPatient(page, 'Group E2E Patient 1');
    await addPatient(page, 'Group E2E Patient 2');

    await page.getByPlaceholder('Message').fill('Reminder from the clinic.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Send this message?' })).toBeVisible();
    await page.getByRole('button', { name: 'Open group session' }).click();

    await page.waitForURL(/\/messages\/campaigns\/[\w-]+/);
    await expect(page.getByText('Batch 1 — 2 recipients')).toBeVisible();

    // The sms: navigation is intercepted so the page stays put.
    await page.route('sms:**', (route) => {
      expect(route.request().url()).toContain('body=');
      return route.abort();
    });

    await page.getByRole('link', { name: 'Send this batch' }).click();
    await expect(page.getByText('Sent').first()).toBeVisible();
  });

  test.afterAll(async () => {
    seedGroup('block');
  });
});
