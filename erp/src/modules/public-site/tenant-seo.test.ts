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
});
