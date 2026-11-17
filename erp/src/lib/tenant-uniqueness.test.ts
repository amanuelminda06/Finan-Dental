import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { MessageSourceType, MessageTemplateKey, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Keep the credential test focused on tenant scoping: audit writes need a
// request context (and a default tenant), which is orthogonal here.
vi.mock('@/lib/audit', () => ({
  clientIp: async () => null,
  writeAudit: async () => {},
}));

import { resetRateLimits } from '@/lib/ratelimit';
import { verifyCredentials } from '@/modules/auth/services/verify-credentials';
import { claimReceiptNumber, formatReceiptNumber } from '@/modules/sales/receipt';

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

describe('per-tenant patient, tag, sale and storage uniqueness', () => {
  it('allows the same phone number in two tenants but rejects a duplicate in one tenant', async () => {
    const phoneE164 = `+2519${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const data = { fullName: 'Shared', phoneE164, createdBy: 'tenant-test' };

    await prisma.patient.create({ data: { ...data, tenantId: tenantA } });
    await prisma.patient.create({ data: { ...data, tenantId: tenantB } });

    await expect(
      prisma.patient.create({ data: { ...data, tenantId: tenantA } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same tag name in two tenants but rejects a duplicate in one tenant', async () => {
    const name = `tag-${randomUUID()}`;
    await prisma.tag.create({ data: { tenantId: tenantA, name, color: '#000000' } });
    await prisma.tag.create({ data: { tenantId: tenantB, name, color: '#000000' } });

    await expect(
      prisma.tag.create({ data: { tenantId: tenantA, name, color: '#000000' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same receipt number in two tenants but rejects a duplicate in one tenant', async () => {
    const receiptNumber = `2026-${randomUUID().replace(/-/g, '').slice(0, 6)}`;
    const data = {
      receiptNumber,
      saleDate: new Date(),
      paymentMethod: 'CASH' as const,
      total: 10,
      createdBy: 'tenant-test',
    };

    await prisma.sale.create({ data: { ...data, tenantId: tenantA } });
    await prisma.sale.create({ data: { ...data, tenantId: tenantB } });

    await expect(
      prisma.sale.create({ data: { ...data, tenantId: tenantA } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same storage key in two tenants but rejects a duplicate in one tenant', async () => {
    const key = `${tenantA}/shared-${randomUUID()}.png`;
    const data = { key, mimeType: 'image/png', data: Buffer.from('test') };

    await prisma.storedFile.create({ data: { ...data, tenantId: tenantA } });
    await prisma.storedFile.create({ data: { ...data, tenantId: tenantB } });

    await expect(
      prisma.storedFile.create({ data: { ...data, tenantId: tenantA } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('per-tenant setting, site-content and receipt counters', () => {
  it('allows the same setting key in two tenants but rejects a duplicate in one tenant', async () => {
    const key = `setting-${randomUUID()}`;
    await prisma.setting.create({ data: { tenantId: tenantA, key, value: 'A' } });
    await prisma.setting.create({ data: { tenantId: tenantB, key, value: 'B' } });

    await expect(
      prisma.setting.create({ data: { tenantId: tenantA, key, value: 'duplicate' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same site-content key in two tenants but rejects a duplicate in one tenant', async () => {
    const key = `content-${randomUUID()}`;
    const data = { key, valueEn: 'A', valueAm: 'A' };
    await prisma.siteContent.create({ data: { ...data, tenantId: tenantA } });
    await prisma.siteContent.create({ data: { ...data, tenantId: tenantB } });

    await expect(
      prisma.siteContent.create({ data: { ...data, tenantId: tenantA } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('lets both tenants claim 2026-000001', async () => {
    const a = await prisma.$transaction((tx) => claimReceiptNumber(tx, 2026, tenantA));
    const b = await prisma.$transaction((tx) => claimReceiptNumber(tx, 2026, tenantB));
    expect(formatReceiptNumber(2026, a)).toBe('2026-000001');
    expect(formatReceiptNumber(2026, b)).toBe('2026-000001');
  });

  it('never collides when one tenant claims concurrently', async () => {
    const claims = await Promise.all(
      Array.from({ length: 10 }, () =>
        prisma.$transaction((tx) => claimReceiptNumber(tx, 2027, tenantA)),
      ),
    );
    expect(new Set(claims).size).toBe(claims.length);
    expect(claims.sort((x, y) => x - y)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
  });

  it('clamps against only the claiming tenant\'s MAX(receiptNumber)', async () => {
    await prisma.sale.create({
      data: {
        tenantId: tenantA,
        receiptNumber: '2031-000500',
        saleDate: new Date(),
        paymentMethod: 'CASH',
        total: 10,
        createdBy: 'tenant-test',
      },
    });

    const b = await prisma.$transaction((tx) => claimReceiptNumber(tx, 2031, tenantB));
    const a = await prisma.$transaction((tx) => claimReceiptNumber(tx, 2031, tenantA));
    expect(b).toBe(1);
    expect(a).toBe(501);
  });
});

describe('per-tenant messaging uniqueness', () => {
  it('allows the same template key and language in two tenants but rejects a duplicate in one tenant', async () => {
    const data = { key: MessageTemplateKey.CUSTOM, language: 'en', body: 'Shared body' };
    await prisma.messageTemplate.create({ data: { ...data, tenantId: tenantA } });
    await prisma.messageTemplate.create({ data: { ...data, tenantId: tenantB } });

    await expect(
      prisma.messageTemplate.create({ data: { ...data, tenantId: tenantA } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same library hash and language in two tenants but rejects a duplicate in one tenant', async () => {
    const normalizedHash = `hash-${randomUUID()}`;
    const data = {
      title: 'Shared',
      body: 'Shared body',
      language: 'en',
      normalizedHash,
      createdBy: 'tenant-test',
    };
    await prisma.messageLibraryItem.create({ data: { ...data, tenantId: tenantA } });
    await prisma.messageLibraryItem.create({ data: { ...data, tenantId: tenantB } });

    await expect(
      prisma.messageLibraryItem.create({ data: { ...data, tenantId: tenantA } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same task tuple in two tenants but rejects a duplicate in one tenant', async () => {
    // patientId only anchors the FK here; the same id is reused so the rest of
    // the unique tuple is identical across tenants.
    const patient = await prisma.patient.create({
      data: {
        tenantId: tenantA,
        fullName: 'Task anchor',
        phoneE164: `+2517${randomUUID().replace(/-/g, '').slice(0, 9)}`,
        createdBy: 'tenant-test',
      },
      select: { id: true },
    });
    const tuple = {
      patientId: patient.id,
      templateKey: MessageTemplateKey.CUSTOM,
      sourceType: MessageSourceType.MANUAL,
      sourceId: `source-${randomUUID()}`,
      language: 'en',
      renderedMessage: 'Shared message',
      dueAt: new Date(),
    };

    await prisma.messageTask.create({ data: { ...tuple, tenantId: tenantA } });
    await prisma.messageTask.create({ data: { ...tuple, tenantId: tenantB } });

    await expect(
      prisma.messageTask.create({ data: { ...tuple, tenantId: tenantA } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
