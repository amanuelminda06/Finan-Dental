import type { PrismaClient } from '@prisma/client';

/** The platform-owned clinic. It is created once and never reset or deleted. */
export const PLATFORM_TENANT_SLUG = 'finandentalclinic';

function refusal(slug: string): Error {
  return new Error(
    `Refusing to delete, reset or overwrite protected tenant "${slug}". ` +
      'This clinic is platform-owned; its data must be preserved.',
  );
}

/** Refuse destructive/overwriting tooling for a protected tenant by slug. */
export async function assertTenantNotProtected(
  prisma: PrismaClient,
  slug: string,
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { protected: true },
  });
  if (tenant?.protected) throw refusal(slug);
}

/** Refuse destructive/overwriting tooling for a protected tenant by id. */
export async function assertTenantIdNotProtected(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true, protected: true },
  });
  if (tenant?.protected) throw refusal(tenant.slug);
}
