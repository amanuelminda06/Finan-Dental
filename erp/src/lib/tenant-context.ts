import { headers } from 'next/headers';
import { env } from '@/env';
import { prisma } from '@/lib/prisma';
import { TENANT_ID_HEADER } from '@/lib/tenant-request-headers';
import { getExplicitTenantId } from '@/lib/tenant-scope';

/**
 * Resolves the tenant for database scoping.
 *
 * - An explicit `runWithTenant()` scope (cron fan-out, seeds, tests) wins.
 * - In a request, the tenant comes from the URL via the proxy's request header.
 *   There is deliberately no session or DEFAULT_TENANT_SLUG fallback here: a
 *   signed-in session may not silently reach a different clinic's data.
 * - Outside any request (scripts, unit tests) DEFAULT_TENANT_SLUG still picks
 *   the seeded clinic.
 *
 * Writes must take tenantId from here (or from a parent row inside the same
 * transaction) — never from form data.
 */

let defaultTenantId: string | null = null;

/** Default tenant id, resolved once per process. */
export async function getDefaultTenantId(): Promise<string> {
  const explicit = getExplicitTenantId();
  if (explicit) return explicit;
  if (defaultTenantId) return defaultTenantId;
  const slug = env.DEFAULT_TENANT_SLUG;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) {
    throw new Error(
      `No tenant found for DEFAULT_TENANT_SLUG="${slug}". Run the seed (npm run db:seed) or point DEFAULT_TENANT_SLUG at an existing tenant.`,
    );
  }
  defaultTenantId = tenant.id;
  return defaultTenantId;
}

/** Tenant id for rows created during this request. */
export async function getTenantId(): Promise<string> {
  const explicit = getExplicitTenantId();
  if (explicit) return explicit;

  let inRequest = false;
  try {
    const headerList = await headers();
    inRequest = true;
    const id = headerList.get(TENANT_ID_HEADER);
    if (id) return id;
  } catch {
    // No request scope — a script or unit test, handled below.
  }
  if (inRequest) {
    throw new Error('Tenant was not resolved from the URL; check the proxy matcher');
  }
  return getDefaultTenantId();
}

/** Test seam: forget the cached default (e.g. after changing the slug). */
export function resetTenantContextCache(): void {
  defaultTenantId = null;
}
