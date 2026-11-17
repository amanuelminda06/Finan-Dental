import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Search gating calls auth(); runWithTenant() is the authoritative tenant so
// the exact session tenant here is irrelevant to isolation.
vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({
    user: {
      id: 'isolation-actor',
      email: 'owner@example.test',
      name: 'Owner',
      role: 'OWNER',
      mustChangePassword: false,
      tenantId: 'session-tenant',
      tenantSlug: 'session-tenant',
    },
  })),
  loginPath: '/login/test',
}));

import { prisma } from '@/lib/prisma';
import { basePrisma } from '@/lib/prisma-base';
import { DatabaseStorage } from '@/lib/database-storage';
import { runWithTenant } from '@/lib/tenant-scope';
import { TenantMismatchError } from '@/lib/tenant-prisma';
import { getPatient, findPatientByPhone, listPatientsForExport } from '@/modules/patients/queries';
import { listSalesForExport } from '@/modules/sales/queries';
import { listAuditForExport } from '@/modules/audit/queries';
import { listFeedback } from '@/modules/feedback/queries';
import {
  getPublicFeedbackTestimonials,
  getPublicServices,
  getSiteContent,
} from '@/modules/public-site/queries';
import { expireTasks } from '@/modules/messaging/generate';
import { GET as search } from '@/app/[tenant]/api/search/route';
import { DEFAULT_TIMEZONE } from '@/lib/datetime';

const marker = `iso-${randomUUID()}`;
let tenantA: string;
let tenantB: string;
const ids: Record<string, { patient: string; sale: string; doctor: string }> = {};

function phone(): string {
  return `+2519${Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, '0')}`;
}

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '5433' || url.pathname !== '/vision_erp') {
    throw new Error('tenant isolation tests must run against the local embedded Postgres only');
  }

  const suffix = randomUUID().slice(0, 8);
  for (const [key, label] of [
    ['A', tenantName('a', suffix)],
    ['B', tenantName('b', suffix)],
  ] as const) {
    const tenant = await basePrisma.tenant.create({
      data: { slug: label.slug, name: label.name, loginSecret: label.slug },
      select: { id: true },
    });
    if (key === 'A') tenantA = tenant.id;
    else tenantB = tenant.id;

    const tenantId = tenant.id;
    await runWithTenant(tenantId, async () => {
      const doctor = await prisma.staff.create({
        data: {
          fullName: `Isolation Doctor ${key}`,
          jobTitle: 'Clinician',
          isDoctor: true,
          showOnWebsite: true,
          active: true,
        },
        select: { id: true },
      });
      const patient = await prisma.patient.create({
        data: {
          fullName: `Isolation Patient ${key}`,
          phoneE164: phone(),
          createdBy: marker,
          active: true,
          preferredLanguage: 'en',
          doNotMessage: false,
        },
        select: { id: true, phoneE164: true },
      });
      const sale = await prisma.sale.create({
        data: {
          receiptNumber: `${marker}-${key}`,
          saleDate: new Date(),
          status: 'CONFIRMED',
          paymentMethod: 'CASH',
          total: 100,
          createdBy: marker,
          patientId: patient.id,
          doctorId: doctor.id,
          tenantId,
        },
        select: { id: true },
      });
      await prisma.auditLog.create({
        data: {
          entity: 'Patient',
          entityId: patient.id,
          action: `ISO_${key}`,
        },
      });
      await prisma.feedback.create({
        data: {
          name: `Isolation Feedback ${key}`,
          text: `Isolation feedback text ${key}`,
          createdBy: 'public-website',
          showOnWebsite: true,
        },
      });
      await prisma.service.create({
        data: {
          name: `Isolation Service ${key}`,
          nameEn: `Isolation Service ${key}`,
          category: 'General',
          isPublic: true,
          active: true,
        },
      });
      await prisma.siteContent.create({
        data: { key: 'hero_title', valueEn: `Hero ${key}`, valueAm: `Hero ${key}` },
      });
      ids[key] = { patient: patient.id, sale: sale.id, doctor: doctor.id };
    });
  }
});

function tenantName(letter: string, suffix: string) {
  return { slug: `iso-${letter}-${suffix}`, name: `Isolation ${letter.toUpperCase()}` };
}

afterAll(async () => {
  await basePrisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  await basePrisma.$disconnect();
});

describe('tenant isolation across application entry points', () => {
  it('scopes list and detail queries by id', async () => {
    const rowsA = await runWithTenant(tenantA, () =>
      listPatientsForExport({ q: 'Isolation Patient' }),
    );
    expect(rowsA.map((row) => row.id)).toEqual([ids.A.patient]);

    const rowsB = await runWithTenant(tenantB, () =>
      listPatientsForExport({ q: 'Isolation Patient' }),
    );
    expect(rowsB.map((row) => row.id)).toEqual([ids.B.patient]);

    await expect(runWithTenant(tenantA, () => getPatient(ids.B.patient))).resolves.toBeNull();
    await expect(runWithTenant(tenantB, () => getPatient(ids.A.patient))).resolves.toBeNull();
    await expect(
      runWithTenant(tenantA, () => getPatient(ids.A.patient)),
    ).resolves.toMatchObject({ id: ids.A.patient });
  });

  it('rejects a caller-supplied tenant that differs from the scope', async () => {
    await expect(
      runWithTenant(tenantB, () =>
        findPatientByPhone(phone(), tenantA),
      ),
    ).rejects.toBeInstanceOf(TenantMismatchError);
  });

  it('rejects cross-tenant scalar FK references in server actions', async () => {
    const { createUserAction } = await import('@/modules/users/actions');
    const email = `cross-${randomUUID()}@example.test`;
    const formData = new FormData();
    formData.set('name', 'Cross Tenant User');
    formData.set('email', email);
    formData.set('role', 'RECEPTION');
    formData.set('password', 'Vx7#kQ9!mR3$tY');
    formData.set('staffId', ids.B.doctor); // staff row owned by tenant B

    const result = await runWithTenant(tenantA, () => createUserAction(null, formData));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('validationError');
      expect(result.fields?.staffId).toBe('unknown');
    }
    // Nothing was written under either tenant.
    expect(await basePrisma.user.count({ where: { email } })).toBe(0);
  });

  it('scopes update and delete by id', async () => {
    await expect(
      runWithTenant(tenantA, () =>
        prisma.sale.update({ where: { id: ids.B.sale }, data: { total: 1 } }),
      ),
    ).rejects.toMatchObject({ code: 'P2025' });
    await expect(
      runWithTenant(tenantA, () => prisma.sale.delete({ where: { id: ids.B.sale } })),
    ).rejects.toMatchObject({ code: 'P2025' });
  });

  it('scopes every export query', async () => {
    const [patients, sales, audit, feedback] = await runWithTenant(tenantA, async () => [
      await listPatientsForExport({}),
      await listSalesForExport({}, DEFAULT_TIMEZONE),
      await listAuditForExport({}, DEFAULT_TIMEZONE),
      await listFeedback({}),
    ]);
    expect(patients.map((row) => row.id)).toEqual([ids.A.patient]);
    expect(sales.map((row) => row.id)).toEqual([ids.A.sale]);
    expect(audit.map((row) => row.action)).toEqual(['ISO_A']);
    expect(feedback.map((row) => row.name)).toEqual(['Isolation Feedback A']);
  });

  it('scopes global search results', async () => {
    async function hits(tenantId: string) {
      const url = new URL('http://localhost/api/search?q=Isolation');
      const request = { url: url.toString(), nextUrl: url } as unknown as NextRequest;
      const response = await runWithTenant(tenantId, () => search(request));
      return (await response.json()) as Record<string, { id: string }[]>;
    }
    const a = await hits(tenantA);
    const b = await hits(tenantB);
    expect(a.patients.map((hit) => hit.id)).toEqual([ids.A.patient]);
    expect(b.patients.map((hit) => hit.id)).toEqual([ids.B.patient]);
    expect(a.sales.every((hit) => hit.id !== ids.B.sale)).toBe(true);
    expect(b.sales.map((hit) => hit.id)).toEqual([ids.B.sale]);
  });

  it('scopes uploads storage reads and deletes', async () => {
    const storage = new DatabaseStorage();
    const keyA = `${tenantA}/iso.png`;
    const data = Buffer.from('89504e470d0a1a0a', 'hex');
    await runWithTenant(tenantA, () => storage.put(keyA, data));

    const crossRead = await runWithTenant(tenantB, () => storage.get(keyA));
    expect(crossRead).toBeNull();
    await runWithTenant(tenantB, () => storage.remove(keyA));
    expect(await basePrisma.storedFile.count({ where: { key: keyA } })).toBe(1);

    const ownRead = await runWithTenant(tenantA, () => storage.get(keyA));
    expect(ownRead?.equals(data)).toBe(true);
    await runWithTenant(tenantA, () => storage.remove(keyA));
    expect(await basePrisma.storedFile.count({ where: { key: keyA } })).toBe(0);
  });

  it('scopes public website feeds', async () => {
    const [servicesA, feedbackA, contentA] = await runWithTenant(tenantA, async () => [
      await getPublicServices(),
      await getPublicFeedbackTestimonials(),
      await getSiteContent(),
    ]);
    expect(servicesA.map((service) => service.name)).toEqual(['Isolation Service A']);
    expect(feedbackA.map((row) => row.name)).toEqual(['Isolation Feedback A']);
    expect(contentA.hero_title.en).toBe('Hero A');

    const [servicesB, feedbackB, contentB] = await runWithTenant(tenantB, async () => [
      await getPublicServices(),
      await getPublicFeedbackTestimonials(),
      await getSiteContent(),
    ]);
    expect(servicesB.map((service) => service.name)).toEqual(['Isolation Service B']);
    expect(feedbackB.map((row) => row.name)).toEqual(['Isolation Feedback B']);
    expect(contentB.hero_title.en).toBe('Hero B');
  });

  it('scopes the messaging cron job to one tenant', async () => {
    const past = new Date(Date.now() - 60_000);
    for (const [tenantId, key] of [
      [tenantA, 'A'],
      [tenantB, 'B'],
    ] as const) {
      await runWithTenant(tenantId, async () => {
        const { createTask } = await import('@/modules/messaging/generate');
        await createTask({
          patient: {
            id: ids[key].patient,
            fullName: `Isolation Patient ${key}`,
            phoneE164: phone(),
            preferredLanguage: 'en',
            doNotMessage: false,
            active: true,
          },
          templateKey: 'APPT_SAME_DAY',
          sourceType: 'APPOINTMENT',
          sourceId: `iso-${key}-${marker}`,
          language: 'en',
          renderedMessage: `ISO ${key}`,
          dueAt: past,
          sendBy: null,
          expiresAt: past,
        });
      });
    }

    const expired = await runWithTenant(tenantA, () => expireTasks(new Date()));
    expect(expired).toBe(1);
    const statuses = await basePrisma.messageTask.findMany({
      where: { sourceId: { in: [`iso-A-${marker}`, `iso-B-${marker}`] } },
      select: { sourceId: true, status: true },
    });
    expect(statuses.find((row) => row.sourceId === `iso-A-${marker}`)?.status).toBe('EXPIRED');
    expect(statuses.find((row) => row.sourceId === `iso-B-${marker}`)?.status).toBe('PENDING');
  });
});
