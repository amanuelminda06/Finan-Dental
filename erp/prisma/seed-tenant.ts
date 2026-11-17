import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

let cachedTenantId: string | null = null;

/** Read the slug directly so importing a seed helper never validates the whole app env. */
function seedTenantSlug(): string {
  const slug = process.env.DEFAULT_TENANT_SLUG ?? 'finan';
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(slug)) {
    throw new Error(`Invalid DEFAULT_TENANT_SLUG: "${slug}"`);
  }
  return slug;
}

/**
 * The tenant every seeded row belongs to until host-based routing lands.
 *
 * Upserted by DEFAULT_TENANT_SLUG so a fresh `prisma migrate reset` followed by
 * the seed always has a tenant to point at — including a custom slug.
 */
export async function ensureSeedTenant(prisma: PrismaClient): Promise<string> {
  if (cachedTenantId) return cachedTenantId;
  const slug = seedTenantSlug();
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: slug === 'finan' ? 'Finan Speciality Dental Clinic' : slug,
      loginSecret: `${slug}-${randomUUID()}`,
    },
    select: { id: true },
  });
  cachedTenantId = tenant.id;
  return cachedTenantId;
}
