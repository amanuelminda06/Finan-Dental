import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  requestTenantId: null as string | null,
  noRequestScope: false,
}));

vi.mock('next/headers', () => ({
  headers: async () => {
    if (state.noRequestScope) throw new Error('headers() called outside a request scope');
    const h = new Headers();
    if (state.requestTenantId) h.set('x-finan-tenant-id', state.requestTenantId);
    return h;
  },
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    const error: Error & { code?: string } = new Error('NOT_FOUND');
    error.code = 'NEXT_NOT_FOUND';
    throw error;
  },
}));

import { assertSessionTenant } from './session-tenant';

describe('assertSessionTenant', () => {
  beforeEach(() => {
    state.requestTenantId = null;
    state.noRequestScope = false;
  });

  it('allows a session bound to the URL tenant', async () => {
    state.requestTenantId = 'tenant-a';
    await expect(assertSessionTenant('tenant-a')).resolves.toBeUndefined();
  });

  it('404s a session bound to a different tenant', async () => {
    state.requestTenantId = 'tenant-a';
    await expect(assertSessionTenant('tenant-b')).rejects.toMatchObject({
      code: 'NEXT_NOT_FOUND',
    });
  });

  it('404s a session with no tenant at a tenant URL', async () => {
    state.requestTenantId = 'tenant-a';
    await expect(assertSessionTenant(undefined)).rejects.toMatchObject({
      code: 'NEXT_NOT_FOUND',
    });
  });

  it('is a no-op outside a request (scripts, tests)', async () => {
    state.noRequestScope = true;
    await expect(assertSessionTenant('tenant-b')).resolves.toBeUndefined();
  });
});
