import { NextRequest, type NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config, proxy } from './proxy';
import {
  TENANT_ID_HEADER,
  TENANT_LOGIN_PATH_HEADER,
  TENANT_SLUG_HEADER,
} from './lib/tenant-request-headers';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: { DEFAULT_TENANT_SLUG: 'finan' },
}));

vi.mock('@/lib/prisma-base', () => ({
  basePrisma: { tenant: { findUnique: mocks.findUnique } },
}));

vi.mock('next-auth/jwt', () => ({
  getToken: mocks.getToken,
}));

process.env.AUTH_SECRET = 'test-secret-at-least-16-characters';

const TENANT = {
  id: 'tenant_a',
  slug: 'finan',
  status: 'ACTIVE',
  trialEndsAt: null,
};

/** Paths a client can reach; the proxy must run for all of them. */
const ROUTES = [
  '/finan',
  '/finan/about',
  '/finan/erp/dashboard',
  '/finan/api/search?q=test',
  '/finan/api/uploads/photo',
  '/finan/api/public/assets/tenant_a/brand-logo.png',
  '/finan/static/hero.jpg',
  '/finan/robots.txt',
  '/finan/sitemap.xml',
];

type OverrideHeaders = Record<string, string>;

function requestFor(path: string, extra: OverrideHeaders = {}): NextRequest {
  return new NextRequest(`https://clinic.test${path}`, {
    headers: {
      // Values a malicious client may send. None may survive the proxy.
      [TENANT_ID_HEADER]: 'forged_tenant',
      [TENANT_SLUG_HEADER]: 'forged-clinic',
      [TENANT_LOGIN_PATH_HEADER]: '/forged-clinic/erp/login',
      'x-locale': 'am',
      ...extra,
    },
  });
}

function overrideHeaders(response: NextResponse): OverrideHeaders {
  const list = response.headers.get('x-middleware-override-headers')?.split(',') ?? [];
  return Object.fromEntries(
    list.map((name) => [
      name,
      response.headers.get(`x-middleware-request-${name}`) ?? '',
    ]),
  );
}

describe('proxy tenant header trust', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset().mockResolvedValue(TENANT);
    mocks.getToken.mockReset().mockResolvedValue(null);
  });

  it('runs on every route family that can touch tenant data', () => {
    expect(config.matcher).toEqual(['/((?!_next).*)']);
    for (const path of ROUTES) {
      expect(path.startsWith('/finan')).toBe(true);
    }
  });

  it.each(ROUTES)('overwrites forged tenant headers on %s', async (path) => {
    // The ERP tree is the one family with a session gate; give it a valid one so
    // the response is the header-injected `next()` rather than a login redirect.
    const signedIn = path.startsWith('/finan/erp/');
    mocks.getToken.mockResolvedValue(signedIn ? { tenantId: TENANT.id } : null);

    const response = await proxy(requestFor(path));
    expect(response.status).toBe(200);
    expect(overrideHeaders(response)).toMatchObject({
      [TENANT_ID_HEADER]: TENANT.id,
      [TENANT_SLUG_HEADER]: TENANT.slug,
      [TENANT_LOGIN_PATH_HEADER]: '/finan/erp/login',
      'x-locale': '',
    });
  });

  it('overwrites an injected locale with the validated ?lang value', async () => {
    const response = await proxy(requestFor('/finan/about?lang=en'));
    expect(overrideHeaders(response)['x-locale']).toBe('en');
  });

  it('ignores forged headers when the URL tenant is not serving', async () => {
    mocks.findUnique.mockResolvedValue({ ...TENANT, status: 'SUSPENDED' });
    const response = await proxy(requestFor('/finan/about'));
    expect(response.status).toBe(404);
    expect(response.headers.get('x-middleware-override-headers')).toBeNull();
  });

  it('ignores a forged session tenant claim from a client', async () => {
    mocks.getToken.mockResolvedValue({ tenantId: 'tenant_b' });
    const response = await proxy(requestFor('/finan/api/search'));
    expect(response.status).toBe(404);
  });
});
