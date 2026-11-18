import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ slug: 'finan' }));

// sitemap.ts / robots.ts resolve the tenant from the request headers injected
// by the proxy. Point them at a chosen tenant for each assertion.
vi.mock('next/headers', () => ({
  headers: async () => {
    const h = new Headers();
    h.set('x-finan-tenant-id', 'tenant-id');
    h.set('x-finan-tenant-slug', state.slug);
    return h;
  },
}));

import sitemap from '@/app/[tenant]/sitemap';
import robots from '@/app/[tenant]/robots';
import { GET as robotsTxt } from '@/app/[tenant]/robots.txt/route';

const original = process.env.PUBLIC_BASE_URL;
beforeAll(() => {
  process.env.PUBLIC_BASE_URL = 'https://clinics.example.com';
});
afterAll(() => {
  if (original === undefined) delete process.env.PUBLIC_BASE_URL;
  else process.env.PUBLIC_BASE_URL = original;
});
beforeEach(() => {
  state.slug = 'finan';
});

describe('per-tenant sitemap', () => {
  it('lists only this tenant’s absolute URLs', async () => {
    const entries = await sitemap();
    expect(entries[0]?.url).toBe('https://clinics.example.com/finan');
    expect(entries.some((entry) => entry.url === 'https://clinics.example.com/finan/about')).toBe(
      true,
    );
    expect(entries.every((entry) => entry.url.startsWith('https://clinics.example.com/finan'))).toBe(
      true,
    );
  });

  it('follows the tenant from the URL', async () => {
    state.slug = 'bright-dental';
    const entries = await sitemap();
    expect(entries[0]?.url).toBe('https://clinics.example.com/bright-dental');
    expect(entries.every((entry) => entry.url.includes('/bright-dental'))).toBe(true);
  });
});

describe('per-tenant robots', () => {
  it('scopes the sitemap, host and rules to this tenant', async () => {
    state.slug = 'bright-dental';
    const config = await robots();
    expect(config.sitemap).toBe('https://clinics.example.com/bright-dental/sitemap.xml');
    expect(config.host).toBe('https://clinics.example.com/bright-dental');
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    expect(rule?.allow).toBe('/bright-dental');
    expect(rule?.disallow).toContain('/bright-dental/api');
    expect(rule?.disallow).toContain('/bright-dental/login');
  });

  it('serves the same config as a per-tenant robots.txt route', async () => {
    // Next only emits nested metadata files from the app root, so the route
    // handler is what actually answers /<tenant>/robots.txt.
    state.slug = 'bright-dental';
    const response = await robotsTxt();
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Allow: /bright-dental');
    expect(body).toContain('Disallow: /bright-dental/api');
    expect(body).toContain('Sitemap: https://clinics.example.com/bright-dental/sitemap.xml');
    expect(body).toContain('Host: https://clinics.example.com/bright-dental');
    expect(body).not.toContain('/finan/');
  });
});
