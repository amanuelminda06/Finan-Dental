import { expect, test } from '@playwright/test';
import {
  appUrl,
  login,
  loginUrl,
  SECOND_TENANT,
  TENANT,
  tenantUrl,
} from './helpers';

const PUBLIC_PATHS = ['/', '/about', '/services', '/doctors', '/book', '/contact', '/faq', '/privacy'];
const APP_PATHS = [
  '/dashboard',
  '/patients',
  '/sales',
  '/appointments',
  '/messages',
  '/settings',
];
const API_PATHS = ['/api/search?q=test', '/api/patients/export', '/api/messages/count'];

/**
 * Every clinic is a URL tree. A session issued for tenant A must never be able
 * to reach tenant B — pages, APIs, SEO files or the login endpoint all have to
 * answer 404 (never a 403, redirect or data response that would reveal B).
 */
test.describe('URL tenant isolation', () => {
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
    for (const path of APP_PATHS) await walk(`/${SECOND_TENANT}/app${path}`);
    for (const path of API_PATHS) await walk(`/${SECOND_TENANT}${path}`);
    await walk(`/${SECOND_TENANT}/sitemap.xml`);
    await walk(`/${SECOND_TENANT}/robots.txt`);

    // Tenant A's secret login path is not valid at tenant B's URL.
    const secret = loginUrl().split('/').pop();
    await walk(`/${SECOND_TENANT}/login/${secret}`);
  });

  test('anonymous visitors see per-tenant public data and SEO', async ({ request }) => {
    // Public pages for both tenants are reachable without a session.
    expect((await request.get(tenantUrl('/about'))).status()).toBe(200);
    expect((await request.get(`/${SECOND_TENANT}/about`)).status()).toBe(200);

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

  test('tenant A’s login secret is rejected at tenant B (no session)', async ({ request }) => {
    const secret = loginUrl().split('/').pop();
    expect((await request.get(loginUrl())).status()).toBe(200);
    expect((await request.get(`/${SECOND_TENANT}/login/${secret}`)).status()).toBe(404);
  });
});
