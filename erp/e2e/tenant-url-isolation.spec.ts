import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import {
  appUrl,
  login,
  loginSecondTenant,
  loginUrl,
  SECOND_TENANT,
  TENANT,
  tenantSnapshot,
  tenantUrl,
} from './helpers';

const PUBLIC_PATHS = [
  '/',
  '/about',
  '/services',
  '/doctors',
  '/book',
  '/contact',
  '/faq',
  '/privacy',
];
const APP_PATHS = [
  '/dashboard',
  '/patients',
  '/sales',
  '/appointments',
  '/messages',
  '/settings',
  '/branding',
  '/login',
];
const API_PATHS = ['/api/search?q=test', '/api/patients/export', '/api/messages/count'];

/**
 * Every clinic is a URL tree. A session issued for tenant A can still browse
 * tenant B's public site in the same browser, but it must never reach B's ERP
 * or authenticated APIs: those answer 404 (never a 403, redirect or data
 * response) through assertSessionTenant() in the app layer.
 */
test.describe('URL tenant isolation', () => {
  test.beforeAll(() => {
    // Local-only provisioning; the script refuses any hosted database. It creates
    // the second tenant through `npm run tenant:create` when absent and writes
    // a snapshot with non-secret branding/message assertions.
    execFileSync('npx', ['tsx', 'scripts/seed-e2e-tenants.ts'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
  });

  test('a tenant-A session can browse tenant-B public pages but not its ERP', async ({ page }) => {
    // Sanity: the session works on its own clinic.
    await login(page, 'OWNER');
    const own = await page.goto(appUrl('/dashboard'));
    expect(own?.status()).toBe(200);

    // Public site, SEO files and the open login stay reachable in one browser.
    for (const path of PUBLIC_PATHS) {
      expect((await page.goto(`/${SECOND_TENANT}${path}`))?.status(), `public ${path}`).toBe(200);
    }
    for (const path of ['/sitemap.xml', '/robots.txt']) {
      expect((await page.goto(`/${SECOND_TENANT}${path}`))?.status(), path).toBe(200);
    }
    expect((await page.goto(`/${SECOND_TENANT}/erp/login`))?.status()).toBe(200);

    // The page must render B's clinic, not A's, while A's session is present.
    const snapshot = tenantSnapshot();
    const bName = snapshot.tenants[SECOND_TENANT]?.clinicName;
    const aName = snapshot.tenants[TENANT]?.clinicName;
    await page.goto(`/${SECOND_TENANT}`);
    if (bName) expect(await page.content()).toContain(bName);
    if (aName && aName !== bName) expect(await page.content()).not.toContain(aName);

    // Tenant data is still closed: the protected layout, actions and API
    // handlers call assertSessionTenant() and 404 a foreign session.
    for (const path of APP_PATHS.filter((path) => path !== '/login')) {
      expect((await page.goto(`/${SECOND_TENANT}/erp${path}`))?.status(), `erp ${path}`).toBe(404);
    }
    for (const path of API_PATHS) {
      expect((await page.goto(`/${SECOND_TENANT}${path}`))?.status(), `api ${path}`).toBe(404);
    }
  });

  test('anonymous visitors see per-tenant public data and SEO', async ({ request }) => {
    // Every public page on both tenants must resolve — asset rewrites must not
    // swallow a real page such as `/<tenant>/services` or `/<tenant>/doctors`.
    for (const path of PUBLIC_PATHS) {
      expect((await request.get(tenantUrl(path))).status(), `A ${path}`).toBe(200);
      expect((await request.get(`/${SECOND_TENANT}${path}`)).status(), `B ${path}`).toBe(200);
    }

    // Both tenants get the dental starter catalogue, but each clinic owns its
    // own rows: the second tenant renamed its consultation service.
    const servicesA = await (await request.get(tenantUrl('/services'))).text();
    const servicesB = await (await request.get(`/${SECOND_TENANT}/services`)).text();
    expect(servicesA).toContain('Free Consultation');
    expect(servicesA).not.toContain('Bright Dental Whitening');
    expect(servicesB).toContain('Bright Dental Whitening');
    expect(servicesB).not.toContain('Free Consultation');

    const sitemapA = await (await request.get(`${tenantUrl('/sitemap.xml')}`)).text();
    const sitemapB = await (await request.get(`/${SECOND_TENANT}/sitemap.xml`)).text();
    expect(sitemapA).toContain(`/${TENANT}/about`);
    expect(sitemapA).not.toContain(`/${SECOND_TENANT}/`);
    expect(sitemapB).toContain(`/${SECOND_TENANT}/about`);
    expect(sitemapB).not.toContain(`/${TENANT}/`);

    const robotsA = await (await request.get(tenantUrl('/robots.txt'))).text();
    const robotsB = await (await request.get(`/${SECOND_TENANT}/robots.txt`)).text();
    expect(robotsA).toContain(`/${TENANT}/sitemap.xml`);
    expect(robotsB).toContain(`/${SECOND_TENANT}/sitemap.xml`);
    expect(robotsB).not.toContain(`/${TENANT}/`);
  });

  test('branding, images and message previews stay with their tenant', async ({
    page,
    browser,
  }) => {
    const snapshot = tenantSnapshot();
    const a = snapshot.tenants[TENANT];
    const b = snapshot.tenants[SECOND_TENANT];
    expect(a, `missing snapshot for ${TENANT}`).toBeTruthy();
    expect(b, `missing snapshot for ${SECOND_TENANT}`).toBeTruthy();
    if (!a || !b) return;

    const readClinic = async (slug: string) => {
      const response = await page.goto(`/${slug}`);
      expect(response?.status(), `public home for ${slug}`).toBe(200);

      // The home page lives in the /(public) route group, so it must inherit
      // the same site chrome as every other public page.
      expect(await page.locator('header nav').count(), `header nav for ${slug}`).toBeGreaterThan(0);
      expect(await page.locator('footer').count(), `footer for ${slug}`).toBeGreaterThan(0);

      const [title, siteName, primary, html] = await Promise.all([
        page.title(),
        page.locator('meta[property="og:site_name"]').getAttribute('content'),
        page.evaluate(() => {
          // The root layout defines neutral CSS variables; the tenant layout
          // overrides them on a descendant. Use the innermost branded element.
          const branded = Array.from(
            document.querySelectorAll<HTMLElement>('[style*="--finan-brand-primary"]'),
          ).pop();
          return getComputedStyle(branded ?? document.documentElement)
            .getPropertyValue('--finan-brand-primary')
            .trim()
            .toLowerCase();
        }),
        page.content(),
      ]);
      return { title, siteName, primary, html };
    };

    const homeA = await readClinic(TENANT);
    expect(homeA.title).toContain(a.clinicName);
    expect(homeA.siteName).toBe(a.clinicName);
    expect(homeA.primary).toBe(a.colors.primary.toLowerCase());
    expect(homeA.html).toContain(a.id);
    expect(homeA.html).not.toContain(b.id);
    expect(homeA.html).not.toContain(b.clinicName);

    const homeB = await readClinic(SECOND_TENANT);
    expect(homeB.title).toContain(b.clinicName);
    expect(homeB.siteName).toBe(b.clinicName);
    expect(homeB.primary).toBe(b.colors.primary.toLowerCase());
    expect(homeB.primary).not.toBe(homeA.primary);
    expect(homeB.html).toContain(b.id);
    expect(homeB.html).not.toContain(a.id);
    expect(homeB.html).not.toContain(a.clinicName);

    // Tenant-owned images: the hero and first service image are stored under
    // the tenant id and served through that tenant's URL tree. The starter
    // hero files are different for each clinic.
    expect(a.heroUrl).not.toBeNull();
    expect(b.heroUrl).not.toBeNull();
    if (a.heroUrl) expect(homeA.html).toContain(a.heroUrl);
    if (b.heroUrl) expect(homeB.html).toContain(b.heroUrl);
    expect(a.heroUrl?.split('/').pop()).not.toBe(b.heroUrl?.split('/').pop());
    expect(a.serviceImageUrl).toContain(`/${a.id}/`);
    expect(b.serviceImageUrl).toContain(`/${b.id}/`);
    expect(a.serviceImageUrl).not.toContain(b.id);
    expect(b.serviceImageUrl).not.toContain(a.id);

    // Rendered SMS previews use each tenant's own clinic name (and therefore
    // never carry the other tenant's identity).
    expect(a.reminder).toContain(a.clinicName);
    expect(b.reminder).toContain(b.clinicName);
    expect(a.reminder).not.toContain(b.clinicName);
    expect(b.reminder).not.toContain(a.clinicName);
    expect(a.reminder).not.toBe(b.reminder);

    // Both OWNERs can open their own branding editor; the other clinic's name
    // is never part of the form's initial values.
    await login(page, 'OWNER');
    const brandingA = await page.goto(appUrl('/branding'));
    expect(brandingA?.status()).toBe(200);
    expect(await page.content()).toContain(a.clinicName);
    expect(await page.content()).not.toContain(b.clinicName);

    const context = await browser.newContext();
    try {
      const secondPage = await context.newPage();
      await loginSecondTenant(secondPage);
      const brandingB = await secondPage.goto(`/${SECOND_TENANT}/erp/branding`);
      expect(brandingB?.status()).toBe(200);
      expect(await secondPage.content()).toContain(b.clinicName);
      expect(await secondPage.content()).not.toContain(a.clinicName);
    } finally {
      await context.close();
    }
  });

  test('open ERP login is reachable anonymously in each tenant', async ({ request }) => {
    expect((await request.get(loginUrl())).status()).toBe(200);
    expect((await request.get(`/${SECOND_TENANT}/erp/login`)).status()).toBe(200);
  });
});
