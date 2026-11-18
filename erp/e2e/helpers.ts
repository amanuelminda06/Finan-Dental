import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/**
 * Shared E2E helpers.
 *
 * Credentials come from the same `.env` as the app (loaded in
 * playwright.config.ts). Seeded RECEPTION and STAFF accounts are created with
 * `mustChangePassword: true`, so `login()` transparently completes the forced
 * change once and remembers the derived password on later runs.
 */

export type RoleKey = 'OWNER' | 'RECEPTION' | 'STAFF';

const LOGIN_PATH = process.env.LOGIN_SECRET_PATH ?? '';

/** Default clinic whose URL tree the e2e suite logs into. */
export const TENANT = process.env.DEFAULT_TENANT_SLUG || 'finan';
export const SECOND_TENANT = process.env.E2E_SECOND_TENANT || 'bright-dental';

/** `/[tenant]/...` for API, login and public-site paths. */
export function tenantUrl(path: string): string {
  return `/${TENANT}${path.startsWith('/') ? path : `/${path}`}`;
}

/** `/[tenant]/app/...` for ERP pages. */
export function appUrl(path: string): string {
  return `/${TENANT}/app${path.startsWith('/') ? path : `/${path}`}`;
}

/** This clinic's secret login URL. */
export function loginUrl(): string {
  return tenantUrl(`/login/${LOGIN_PATH}`);
}

const CREDENTIALS: Record<RoleKey, { email: string; password: string }> = {
  OWNER: {
    email: process.env.OWNER_EMAIL ?? '',
    password: process.env.OWNER_PASSWORD ?? '',
  },
  RECEPTION: {
    email: process.env.RECEPTION_EMAIL ?? '',
    password: process.env.RECEPTION_PASSWORD ?? '',
  },
  STAFF: {
    email: process.env.STAFF_EMAIL ?? '',
    password: process.env.STAFF_PASSWORD ?? '',
  },
};

/**
 * Password used after the forced first-login change. Deliberately independent
 * of the seeded password and the account's email/name: the app rejects a
 * password that repeats the user's name or email local part, and the seeded
 * reception/staff local parts would otherwise leak into the derived value.
 * Deterministic so a second run can sign in with it idempotently.
 */
const E2E_DERIVED_PASSWORD = 'Zx9!vL2#qM7';

function derivedPassword(): string {
  return E2E_DERIVED_PASSWORD;
}

function assertConfigured(role: RoleKey) {
  const { email, password } = CREDENTIALS[role];
  if (!LOGIN_PATH || !email || !password) {
    throw new Error(
      `E2E not configured: set LOGIN_SECRET_PATH and ${role}_EMAIL/${role}_PASSWORD in .env (or .env.example).`,
    );
  }
}

async function submitCredentials(page: Page, email: string, password: string) {
  // In dev, the first navigation is followed by an HMR tree swap that can
  // transiently leave the form inputs disabled; retry until they settle.
  await expect(async () => {
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    await expect(emailInput).toBeEnabled();
    await expect(passwordInput).toBeEnabled();
    await emailInput.fill(email);
    await passwordInput.fill(password);
  }).toPass({ timeout: 30_000 });
  await page.getByRole('button', { name: /sign in/i }).click();
}

async function completeForcedChange(page: Page, currentPassword: string, newPassword: string) {
  await page.fill('#currentPassword', currentPassword);
  await page.fill('#newPassword', newPassword);
  await page.fill('#confirmPassword', newPassword);
  await page.getByRole('button', { name: /save|change/i }).click();
}

/**
 * Sign in and land on /dashboard, completing the forced password change when
 * the account still requires it. Idempotent: a second run uses the derived
 * password directly.
 */
export async function login(page: Page, role: RoleKey = 'OWNER') {
  assertConfigured(role);
  const { email, password } = CREDENTIALS[role];
  const derived = derivedPassword();

  await page.goto(loginUrl());
  await submitCredentials(page, email, password);

  const outcome = await Promise.race([
    page
      .waitForURL(/\/(dashboard|change-password)/, { timeout: 20_000 })
      .then(() => 'navigated' as const),
    // Scope to the form: Next's route announcer is also role="alert" and
    // appears after every navigation, which would mask a successful sign-in.
    page
      .locator('form [role="alert"]')
      .waitFor({ timeout: 20_000 })
      .then(() => 'error' as const),
  ]).catch(() => 'timeout' as const);

  if (outcome === 'error' || outcome === 'timeout') {
    // A previous run already changed the password to the derived value.
    await submitCredentials(page, email, derived);
    await page.waitForURL(/\/(dashboard|change-password)/, { timeout: 20_000 });
  }

  if (page.url().includes('/change-password')) {
    await completeForcedChange(page, password, derived);
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  }

  await expect(page).toHaveURL(/\/dashboard/);
}

/** Assert the current page redirected to the friendly 403 page. */
export async function expectForbidden(page: Page, path: string) {
  await page.goto(appUrl(path));
  await expect(page).toHaveURL(/\/403/);
}

export type E2eTenant = {
  slug: string;
  id: string;
  name: string;
  clinicName: string;
  loginPath: string;
  ownerEmail?: string;
  ownerPassword?: string;
  colors: { primary: string; secondary: string; accent: string };
  heroUrl: string | null;
  logoUrl: string | null;
  serviceNames: string[];
  serviceImageUrl: string | null;
  reminder: string;
};

export type E2eTenantSnapshot = {
  generatedAt: string;
  database: string;
  tenants: Record<string, E2eTenant>;
};

/** Local-only snapshot written by `scripts/seed-e2e-tenants.ts`. */
export function tenantSnapshot(): E2eTenantSnapshot {
  const path = process.env.E2E_TENANT_SNAPSHOT ?? '/tmp/opencode/erp-e2e-tenants.json';
  return JSON.parse(readFileSync(path, 'utf8')) as E2eTenantSnapshot;
}

/** Sign in as the deterministic OWNER created for the second e2e tenant. */
export async function loginSecondTenant(page: Page): Promise<E2eTenant> {
  const snapshot = tenantSnapshot();
  const tenant = snapshot.tenants[SECOND_TENANT];
  if (!tenant?.ownerEmail || !tenant.ownerPassword) {
    throw new Error(`No local OWNER credentials for ${SECOND_TENANT}; run scripts/seed-e2e-tenants.ts`);
  }
  await page.goto(tenant.loginPath);
  await page.locator('#email').fill(tenant.ownerEmail);
  await page.locator('#password').fill(tenant.ownerPassword);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return tenant;
}
