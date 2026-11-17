import { createTenantPrisma } from '@/lib/tenant-prisma';

/** Tenant-scoped Prisma client used by all application code. */
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createTenantPrisma>;
};

export const prisma = globalForPrisma.prisma ?? createTenantPrisma();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
