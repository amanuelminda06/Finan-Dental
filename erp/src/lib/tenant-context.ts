import { auth } from '@/auth';
import { env } from '@/env';
import { prisma } from '@/lib/prisma';

/**
 * Resolves the tenant for the current request.
 *
 * - Signed-in requests use the tenant baked into the session JWT at sign-in.
 * - Anonymous flows (public booking/feedback, cron jobs) fall back to the
 *   tenant named by DEFAULT_TENANT_SLUG until host-based tenancy lands.
 *
 * Writes must take tenantId from here (or from a parent row inside the same
 * transaction) — never from form data.
 */

let defaultTenantId: string | null = null;

/** Default tenant id, resolved once per process. */
export async function getDefaultTenantId(): Promise<string> {
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
  const session = await auth();
  if (session?.user?.tenantId) return session.user.tenantId;
  return getDefaultTenantId();
}

/** Test seam: forget the cached default (e.g. after changing the slug). */
export function resetTenantContextCache(): void {
  defaultTenantId = null;
}
