import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  isTenantOwnedModel,
  TENANT_OWNED_MODELS,
  TenantMismatchError,
} from '@/lib/tenant-prisma';
import { basePrisma } from '@/lib/prisma-base';
import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/tenant-scope';

let tenantA: string;
let tenantB: string;
const marker = `scope-${randomUUID()}`;

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '5433' || url.pathname !== '/vision_erp') {
    throw new Error('tenant isolation tests must run against the local embedded Postgres only');
  }
  const suffix = randomUUID().slice(0, 8);
  tenantA = (
    await basePrisma.tenant.create({
      data: { slug: `scope-a-${suffix}`, name: 'Scope A', loginSecret: `scope-a-${suffix}` },
      select: { id: true },
    })
  ).id;
  tenantB = (
    await basePrisma.tenant.create({
      data: { slug: `scope-b-${suffix}`, name: 'Scope B', loginSecret: `scope-b-${suffix}` },
      select: { id: true },
    })
  ).id;
});

afterAll(async () => {
  await basePrisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  await basePrisma.$disconnect();
});

async function patientIn(tenantId: string, name: string) {
  return runWithTenant(tenantId, () =>
    prisma.patient.create({
      data: {
        fullName: name,
        phoneE164: `+2519${randomUUID().replace(/-/g, '').slice(0, 9)}`,
        createdBy: marker,
      },
      select: { id: true, tenantId: true },
    }),
  );
}

describe('schema-derived tenant models', () => {
  it('includes every model with tenantId and excludes Tenant', () => {
    expect(isTenantOwnedModel('Patient')).toBe(true);
    expect(isTenantOwnedModel('ReceiptCounter')).toBe(true);
    expect(isTenantOwnedModel('Tenant')).toBe(false);
    expect(TENANT_OWNED_MODELS).toContain('Patient');
    expect(TENANT_OWNED_MODELS).toHaveLength(28);
  });
});

describe('tenant-scoped Prisma extension', () => {
  it('scopes lists and detail lookups, and rejects cross-tenant writes', async () => {
    const a = await patientIn(tenantA, 'Scoped A');
    const b = await patientIn(tenantB, 'Scoped B');
    expect(a.tenantId).toBe(tenantA);
    expect(b.tenantId).toBe(tenantB);

    const listA = await runWithTenant(tenantA, () =>
      prisma.patient.findMany({ where: { createdBy: marker }, select: { id: true, tenantId: true } }),
    );
    expect(listA).toEqual([expect.objectContaining({ id: a.id, tenantId: tenantA })]);

    await expect(
      runWithTenant(tenantA, () => prisma.patient.findUnique({ where: { id: b.id } })),
    ).resolves.toBeNull();
    await expect(
      runWithTenant(tenantA, () =>
        prisma.patient.update({ where: { id: b.id }, data: { fullName: 'hijacked' } }),
      ),
    ).rejects.toMatchObject({ code: 'P2025' });
    await expect(
      runWithTenant(tenantA, () => prisma.patient.delete({ where: { id: b.id } })),
    ).rejects.toMatchObject({ code: 'P2025' });
  });

  it('throws when data or filters carry a different tenantId', async () => {
    const data = {
      fullName: 'Mismatch',
      phoneE164: `+2519${randomUUID().replace(/-/g, '').slice(0, 9)}`,
      createdBy: marker,
    };
    await expect(
      runWithTenant(tenantA, () => prisma.patient.create({ data: { ...data, tenantId: tenantB } })),
    ).rejects.toBeInstanceOf(TenantMismatchError);
    await expect(
      runWithTenant(tenantA, () =>
        prisma.patient.findMany({ where: { tenantId: tenantB }, select: { id: true } }),
      ),
    ).rejects.toBeInstanceOf(TenantMismatchError);
  });

  it('scopes nested writes and rejects cross-tenant connects', async () => {
    const doctorA = await runWithTenant(tenantA, () =>
      prisma.staff.create({
        data: { fullName: 'Scope Doctor A', jobTitle: 'Clinician' },
        select: { id: true, tenantId: true },
      }),
    );
    const doctorB = await runWithTenant(tenantB, () =>
      prisma.staff.create({
        data: { fullName: 'Scope Doctor B', jobTitle: 'Clinician' },
        select: { id: true },
      }),
    );
    expect(doctorA.tenantId).toBe(tenantA);

    const patient = await runWithTenant(tenantA, () =>
      prisma.patient.create({
        data: {
          fullName: 'Nested A',
          phoneE164: `+2519${randomUUID().replace(/-/g, '').slice(0, 9)}`,
          createdBy: marker,
          appointments: {
            create: {
              doctor: { connect: { id: doctorA.id } },
              startsAt: new Date('2027-02-01T08:00:00Z'),
              endsAt: new Date('2027-02-01T08:30:00Z'),
              createdBy: marker,
            },
          },
        },
        select: { id: true, tenantId: true, appointments: { select: { tenantId: true } } },
      }),
    );
    expect(patient.tenantId).toBe(tenantA);
    expect(patient.appointments).toEqual([{ tenantId: tenantA }]);

    await expect(
      runWithTenant(tenantA, () =>
        prisma.patient.create({
          data: {
            fullName: 'Nested bad connect',
            phoneE164: `+2519${randomUUID().replace(/-/g, '').slice(0, 9)}`,
            createdBy: marker,
            appointments: {
              create: {
                doctor: { connect: { id: doctorB.id } },
                startsAt: new Date('2027-02-02T08:00:00Z'),
                endsAt: new Date('2027-02-02T08:30:00Z'),
                createdBy: marker,
              },
            },
          },
        }),
      ),
    ).rejects.toMatchObject({ code: 'P2025' });
  });

  it('keeps interactive transactions inside the selected tenant', async () => {
    const created = await runWithTenant(tenantA, () =>
      prisma.$transaction(async (tx) => {
        const patient = await tx.patient.create({
          data: {
            fullName: 'Tx A',
            phoneE164: `+2519${randomUUID().replace(/-/g, '').slice(0, 9)}`,
            createdBy: marker,
          },
          select: { id: true, tenantId: true },
        });
        const tag = await tx.tag.create({
          data: { name: `tx-${randomUUID()}`, color: '#000000' },
          select: { id: true, tenantId: true },
        });
        await tx.patientTag.create({
          data: { patientId: patient.id, tagId: tag.id, tenantId: tenantA },
        });
        return { patient, tag };
      }),
    );
    expect(created.patient.tenantId).toBe(tenantA);
    expect(created.tag.tenantId).toBe(tenantA);
  });
});
