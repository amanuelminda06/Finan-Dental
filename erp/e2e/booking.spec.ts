import { test, expect } from '@playwright/test';
import { login } from './helpers';

/**
 * The public website (and its booking flow) is intentionally unchanged. The
 * ERP no longer displays appointments, so the booking API is exercised on its
 * own and the old ERP route is checked separately.
 */
test.describe('public website booking', () => {
  test('the public booking endpoint is still available', async ({ request }) => {
    const stamp = Date.now().toString().slice(-8);
    const preferredDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const response = await request.post('/api/public/requests', {
      data: {
        name: `E2E Booking ${stamp}`,
        phone: `09${stamp}`,
        preferredDate,
        preferredTimeWindow: 'any',
        serviceInterest: '',
        message: 'E2E automated booking',
        language: 'en',
        consent: true,
        website: '',
      },
    });

    // The production server fails closed without Turnstile keys. Local e2e has
    // no challenge token, so record that case as skipped instead of a failure.
    if (response.status() === 422) {
      const body = await response.json();
      test.skip(
        body?.fields?.turnstileToken === 'required',
        'Turnstile is enabled and no test token is configured',
      );
    }
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.appointment).toMatchObject({ date: preferredDate });
    expect(body.appointment.doctor).toBeTruthy();
  });

  test('the ERP no longer displays an appointments screen', async ({ page }) => {
    await login(page, 'RECEPTION');
    await page.goto('/appointments');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('link', { name: 'Appointments', exact: true })).toHaveCount(0);
  });
});
