import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Keep the credential test focused on tenant scoping: audit writes need a
// request context (and a default tenant), which is orthogonal here.
vi.mock('@/lib/audit', () => ({
  clientIp: async () => null,
  writeAudit: async () => {},
}));

import { resetRateLimits } from '@/lib/ratelimit';
import { verifyCredentials } from '@/modules/auth/services/verify-credentials';

const prisma = new PrismaClient();
let tenantA: string;
let tenantB: string;

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '5433' || url.pathname !== '/vision_erp') {
    throw new Error('tenant uniqueness tests must run against the local embedded Postgres only');
  }

  const suffix = randomUUID().slice(0, 8);
  const a = await prisma.tenant.create({
    data: { slug: `tenant-a-${suffix}`, name: 'Tenant A', loginSecret: `a-${suffix}` },
    select: { id: true },
  });
  const b = await prisma.tenant.create({
    data: { slug: `tenant-b-${suffix}`, name: 'Tenant B', loginSecret: `b-${suffix}` },
    select: { id: true },
  });
  tenantA = a.id;
  tenantB = b.id;
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  await prisma.$disconnect();
});

describe('per-tenant user uniqueness', () => {
  it('allows the same email in two tenants but rejects a duplicate inside one tenant', async () => {
    const email = `shared-${randomUUID()}@example.com`;
    const passwordHash = await hash('TenantTest-Pass-77!');
    const data = { name: 'Shared', passwordHash, role: 'RECEPTION' as const };

    await prisma.user.create({ data: { ...data, tenantId: tenantA, email } });
    await prisma.user.create({ data: { ...data, tenantId: tenantB, email } });

    await expect(
      prisma.user.create({ data: { ...data, tenantId: tenantA, email } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects two users with the same staffId inside one tenant', async () => {
    const staffId = `staff-${randomUUID()}`;
    await prisma.staff.create({
      data: { id: staffId, tenantId: tenantA, fullName: 'Shared', jobTitle: 'Clinician' },
    });

    const passwordHash = await hash('TenantTest-Pass-77!');
    const data = { passwordHash, role: 'STAFF' as const, name: 'Shared user', staffId };
    await prisma.user.create({ data: { ...data, tenantId: tenantA, email: `a-${randomUUID()}@example.com` } });

    await expect(
      prisma.user.create({
        data: { ...data, tenantId: tenantA, email: `dup-${randomUUID()}@example.com` },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it("rejects tenant A's credentials when verified against tenant B", async () => {
    resetRateLimits();
    const email = `creds-${randomUUID()}@example.com`;
    const password = 'TenantTest-Pass-77!';
    await prisma.user.create({
      data: {
        tenantId: tenantA,
        email,
        name: 'Tenant A user',
        role: 'OWNER',
        passwordHash: await hash(password),
      },
    });

    const own = await verifyCredentials({ email, password }, tenantA);
    expect(own?.email).toBe(email);
    expect(own?.tenantId).toBe(tenantA);

    const wrongTenant = await verifyCredentials({ email, password }, tenantB);
    expect(wrongTenant).toBeNull();
  });
});
