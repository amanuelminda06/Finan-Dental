import { PrismaClient } from '@prisma/client';

/**
 * Unscoped Prisma client. Direct use is restricted by
 * `scripts/check-prisma-allowlist.mjs`; application code must use `@/lib/prisma`.
 */
const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient };

export const basePrisma = globalForPrisma.prismaBase ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaBase = basePrisma;
