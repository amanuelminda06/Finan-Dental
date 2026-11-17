import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  TENANT_ID_HEADER,
  TENANT_LOGIN_PATH_HEADER,
  TENANT_SLUG_HEADER,
} from './tenant-request-headers';
import { runWithTenant } from './tenant-scope';

export type RequestTenant = { id: string; slug: string };

/**
 * The tenant for this request, resolved by `proxy.ts` from the first URL
 * segment. There is deliberately no default-tenant fallback here: a missing
 * header means the request bypassed the proxy and must not touch tenant data.
 */
export async function getRequestTenant(): Promise<RequestTenant> {
  const headerList = await headers();
  const id = headerList.get(TENANT_ID_HEADER);
  const slug = headerList.get(TENANT_SLUG_HEADER);
  if (!id || !slug) notFound();
  return { id, slug };
}

/** Tenant id from the URL, or null outside a request (scripts, tests). */
export async function getRequestTenantId(): Promise<string | null> {
  try {
    const headerList = await headers();
    return headerList.get(TENANT_ID_HEADER);
  } catch {
    return null;
  }
}

/** This clinic's secret login URL, injected by the proxy from Tenant.loginSecret. */
export async function getRequestLoginPath(): Promise<string> {
  const headerList = await headers();
  const loginPath = headerList.get(TENANT_LOGIN_PATH_HEADER);
  if (!loginPath) notFound();
  return loginPath;
}

/** Run an async unit of work inside the URL-resolved tenant scope. */
export async function withRequestTenant<T>(fn: () => T | Promise<T>): Promise<T> {
  const tenant = await getRequestTenant();
  return runWithTenant(tenant.id, fn);
}
