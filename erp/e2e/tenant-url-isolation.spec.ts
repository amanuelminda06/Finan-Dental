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

const PUBLIC_PATHS = ['/', '/about', '/services', '/doctors', '/book', '/contact', '/faq', '/privacy'];
const APP_PATHS = [
  '/dashboard',
  '/patients',
  '/sales',
  '/erpointments',
  '/messages',
  '/settings',
  '/branding',
];
const API_PATHS = ['/api/search?q=test', '/api/patients/export', '/api/messages/count'];

/**
 * Every clinic is a URL tree. A session issued for tenant A must never be able
 * to reach tenant B — pages, APIs, SEO files or the login endpoint all have to
 * answer 404 (never a 403, redirect or data response that would reveal B).
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

  test('a tenant-A session gets 404 on every tenant-B route', async ({ page }) => {
    // Sanity: the session works on its own clinic.
    await login(page, 'OWNER');
    const own = await page.goto(appUrl('/dashboard'));
    expect(own?.status()).toBe(200);

    const walk = async (path: string) => {
      const response = await page.goto(path);
      expect(response?.status(), `expected 404 for ${path}`).toBe(404);
    };

    for (const path of PUBLIC_PATHS) await walk(`/${SECOND_TENANT}${path}`);
    for (const path of APP_PATHS) await walk(`/${SECOND_TENANT}/erp${path}`);
    for (const path of API_PATHS) await walk(`/${SECOND_TENANT}${path}`);
    await walk(`/${SECOND_TENANT}/sitemap.xml`);
    await walk(`/${SECOND_TENANT}/robots.txt`);

    // No /login/* path at B is valid for a session issued by A — not A's
    // secret, and not an arbitrary path that might be B's own secret.
    const secret = loginUrl().split('/').pop();
    await walk(`/${SECOND_TENANT}/login/${secret}`);
    await walk(`/${SECOND_TENANT}/login/another-clinic-secret`);
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

  test('branding, images and message previews stay with their tenant', async ({ page, browser }) => {
    const snapshot = tenantSnapshot();
    const a = snapshot.tenants[TENANT];
    const b = snapshot.tenants[SECOND_TENANT];
    expect(a, `missing snapshot for ${TENANT}`).toBeTruthy();
    expect(b, `missing snapshot for ${SECOND_TENANT}`).toBeTruthy();
    if (!a || !b) return;

    const readClinic = async (slug: string) => {
      const response = await page.goto(`/${slug}`);
      expect(response?.status(), `public home for ${slug}`).toBe(200);
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
    // the tenant id and served through that tenant's URL tree.
    if (a.heroUrl) expect(homeA.html).toContain(a.id);
    if (b.heroUrl) expect(homeB.html).toContain(b.id);
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

  test('tenant A’s login secret is rejected at tenant B (no session)', async ({ request }) => {
    const secret = loginUrl().split('/').pop();
    expect((await request.get(loginUrl())).status()).toBe(200);
    expect((await request.get(`/${SECOND_TENANT}/login/${secret}`)).status()).toBe(404);
  });
});
