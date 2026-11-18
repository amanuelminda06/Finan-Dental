import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  tenantId: 'tenant_a' as string | null,
  brand: null as Record<string, string | null> | null,
  files: new Map<string, Buffer>(),
}));

vi.mock('next/server', () => ({ connection: vi.fn(async () => undefined) }));

vi.mock('next/headers', () => ({
  headers: async () => {
    const list = new Headers();
    if (state.tenantId) list.set('x-finan-tenant-id', state.tenantId);
    return list;
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantBrand: { findUnique: vi.fn(async () => state.brand) },
  },
}));

vi.mock('@/lib/storage', () => ({
  storage: {
    get: vi.fn(async (key: string) => state.files.get(key) ?? null),
  },
}));

import { GET } from './[...key]/route';

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

function context(key: string[]) {
  return { params: Promise.resolve({ key }) };
}

describe('public tenant brand assets', () => {
  beforeEach(() => {
    state.tenantId = 'tenant_a';
    state.brand = {
      logoKey: 'tenant_a/brand-logo.png',
      heroKey: 'tenant_a/brand-hero.jpg',
      logoDarkKey: null,
      heroSecondaryKey: null,
      doctorPhotoKey: null,
    };
    state.files.clear();
    state.files.set('tenant_a/brand-logo.png', PNG);
    state.files.set('tenant_a/brand-hero.jpg', PNG);
    state.files.set('tenant_b/brand-logo.png', PNG);
    state.files.set('tenant_a/orphan.png', PNG);
  });

  it('serves a published image owned and referenced by the URL tenant', async () => {
    const response = await GET(new Request('https://clinic.test/finan/api/public/assets/x'), {
      ...context(['tenant_a', 'brand-logo.png']),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await response.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it('refuses a key belonging to another tenant even when the bytes exist', async () => {
    const response = await GET(new Request('https://clinic.test/finan/api/public/assets/x'), {
      ...context(['tenant_b', 'brand-logo.png']),
    });
    expect(response.status).toBe(404);
  });

  it('refuses an own-tenant key that the brand no longer references', async () => {
    const response = await GET(new Request('https://clinic.test/finan/api/public/assets/x'), {
      ...context(['tenant_a', 'orphan.png']),
    });
    expect(response.status).toBe(404);
  });

  it('refuses a request without a proxy-resolved tenant', async () => {
    state.tenantId = null;
    const response = await GET(new Request('https://clinic.test/finan/api/public/assets/x'), {
      ...context(['tenant_a', 'brand-logo.png']),
    });
    expect(response.status).toBe(404);
  });
});
