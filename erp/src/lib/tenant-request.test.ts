import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  headersAvailable: true,
  loginPath: null as string | null,
}));

vi.mock('next/headers', () => ({
  headers: async () => {
    if (!state.headersAvailable) throw new Error('headers() called outside a request scope');
    const headerList = new Headers();
    if (state.loginPath) headerList.set('x-finan-login-path', state.loginPath);
    return headerList;
  },
}));

const notFound = vi.hoisted(() => {
  const fn = vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  });
  return fn;
});

vi.mock('next/navigation', () => ({ notFound }));

import { getRequestLoginPath, hasRequestContext } from './tenant-request';
import { TENANT_LOGIN_PATH_HEADER } from './tenant-request-headers';

beforeEach(() => {
  state.headersAvailable = true;
  state.loginPath = null;
  notFound.mockClear();
});

describe('request-context detection', () => {
  it('distinguishes a request from a script/test context', async () => {
    expect(await hasRequestContext()).toBe(true);
    state.headersAvailable = false;
    expect(await hasRequestContext()).toBe(false);
  });
});

describe('getRequestLoginPath', () => {
  it('uses the login path injected by the proxy', async () => {
    state.loginPath = '/bright-dental/erp/login';
    expect(await getRequestLoginPath()).toBe('/bright-dental/erp/login');
    expect(notFound).not.toHaveBeenCalled();
  });

  it('fails closed when a request has no login-path header', async () => {
    // The proxy always injects this header; a missing value means the request
    // bypassed it, so no default tenant login path may be substituted.
    expect(TENANT_LOGIN_PATH_HEADER).toBe('x-finan-login-path');
    await expect(getRequestLoginPath()).rejects.toThrow(/404/);
    expect(notFound).toHaveBeenCalledOnce();
  });
});
