import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { assertTenantNotProtected, PLATFORM_TENANT_SLUG } from '../src/lib/tenant-protection';

let cachedTenantId: string | null = null;

/** Read the slug directly so importing a seed helper never validates the whole app env. */
function seedTenantSlug(): string {
  const slug = process.env.DEFAULT_TENANT_SLUG ?? 'finandentalclinic';
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(slug)) {
    throw new Error(`Invalid DEFAULT_TENANT_SLUG: "${slug}"`);
  }
  return slug;
}

/**
 * Read-only lookup for local e2e fixtures that add rows to an existing tenant.
 * It never creates, resets or overwrites a tenant, so it is safe to use with
 * the protected platform tenant.
 */
export async function getSeedTenantId(prisma: PrismaClient): Promise<string> {
  const slug = seedTenantSlug();
  const existing = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!existing) {
    throw new Error(
      `Seed tenant "${slug}" does not exist. Run \`npm run seed:platform\` first.`,
    );
  }
  return existing.id;
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
  if (slug === PLATFORM_TENANT_SLUG) {
    const exists = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) {
      throw new Error(
        `Protected tenant "${slug}" is missing. Run \`npm run seed:platform\` first.`,
      );
    }
  }
  await assertTenantNotProtected(prisma, slug);
  const existing = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    cachedTenantId = existing.id;
    return cachedTenantId;
  }
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: slug === PLATFORM_TENANT_SLUG ? 'Finan Speciality Dental Clinic' : slug,
      loginSecret: `${slug}-${randomUUID()}`,
    },
    select: { id: true },
  });
  cachedTenantId = tenant.id;
  return cachedTenantId;
}
