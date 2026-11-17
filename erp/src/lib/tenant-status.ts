/** Pure tenant lifecycle rules shared by the URL gate and cron fan-out. */

export type TenantLifecycle = {
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  trialEndsAt: Date | null;
};

/**
 * Unknown tenants are handled by the caller (no row). A suspended clinic or a
 * trial whose end time has passed must look exactly like a missing clinic:
 * both return 404, never a login page or a data leak.
 */
export function isTenantServing(tenant: TenantLifecycle, now = new Date()): boolean {
  if (tenant.status === 'SUSPENDED') return false;
  if (tenant.status === 'TRIAL' && tenant.trialEndsAt) {
    return tenant.trialEndsAt.getTime() > now.getTime();
  }
  return tenant.status === 'TRIAL' || tenant.status === 'ACTIVE';
}

/** Prisma `where` clause for tenants whose message jobs should run. */
export function cronTenantWhere(now = new Date()) {
  return {
    OR: [
      { status: 'ACTIVE' as const },
      { status: 'TRIAL' as const, trialEndsAt: null },
      { status: 'TRIAL' as const, trialEndsAt: { gt: now } },
    ],
  };
}
