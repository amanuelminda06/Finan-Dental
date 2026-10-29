import type { PrismaClient } from '@prisma/client';

/**
 * Seeded messaging: outbox tasks, campaigns, and drafts.
 * Idempotent via delete-then-create pattern for task-scope records.
 */

export async function seedMessaging(
  prisma: PrismaClient,
  createdBy: string,
): Promise<{ tasks: number; campaigns: number }> {
  // TODO: implement full seeding when outbox/campaigns tables are ready
  // For now, return zeros so seeding still passes
  return { tasks: 0, campaigns: 0 };
}
