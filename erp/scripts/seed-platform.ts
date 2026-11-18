/**
 * Idempotent platform seed: ensure the protected Finan tenant exists.
 *
 *   npm run seed:platform
 *   DATABASE_URL="$DIRECT_URL" npm run seed:platform -- --allow-hosted
 *
 * If `finandentalclinic` already exists this script makes NO changes at all.
 * Otherwise it creates that one protected tenant with Finan branding, the
 * doctor, nine services and the same demo data as the old local `finan` seed.
 * Only the database target and tenant slug are printed — never credentials.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { TRIAL_LOGINS, trialEmail } from '../src/lib/trial-credentials';
import { PLATFORM_TENANT_SLUG } from '../src/lib/tenant-protection';

/** tsx does not load .env automatically — minimal loader for script runs. */
function loadEnv(): void {
  const url = new URL('../.env', import.meta.url);
  if (!existsSync(url)) return;
  for (const line of readFileSync(url, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] in process.env) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadEnv();

function databaseTarget(allowHosted: boolean): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const url = new URL(raw);
  const port = url.port || (url.protocol === 'postgresql:' ? '5432' : '5433');
  const target = `${url.hostname}:${port}/${url.pathname.replace(/^\//, '')}`;
  console.log(`Database: ${target}`);
  const local =
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost') && port === '5433';
  if (!local && !allowHosted) {
    throw new Error(
      `Refusing to seed ${target} — local embedded Postgres only. ` +
        'Pass --allow-hosted deliberately for a hosted Neon database.',
    );
  }
  return target;
}

async function main(): Promise<void> {
  const allowHosted = process.argv.includes('--allow-hosted');
  databaseTarget(allowHosted);

  const { applyDentalTemplate } = await import('../prisma/tenant-template');
  const { seedHr } = await import('../prisma/seed-hr');
  const { seedAppointments } = await import('../prisma/seed-appointments');
  const { seedMessageLibrary, seedAudiences } = await import('../prisma/seed-library');

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.tenant.findUnique({
      where: { slug: PLATFORM_TENANT_SLUG },
      select: { id: true },
    });
    if (existing) {
      console.log(`✓ platform tenant ${PLATFORM_TENANT_SLUG} already exists; no changes made`);
      return;
    }

    const tenant = await prisma.tenant.create({
      data: {
        slug: PLATFORM_TENANT_SLUG,
        name: 'Finan Speciality Dental Clinic',
        status: 'ACTIVE',
        trialEndsAt: null,
        protected: true,
        // Legacy uniqueness column only; login no longer uses it.
        loginSecret: `${PLATFORM_TENANT_SLUG}-${randomBytes(24).toString('base64url')}`,
      },
      select: { id: true },
    });

    const template = await applyDentalTemplate(prisma, tenant.id, {
      clinicName: 'Finan Speciality Dental Clinic',
      legacy: true,
      demoData: true,
    });

    const doctor = await prisma.staff.findFirst({
      where: { tenantId: tenant.id, isDoctor: true, showOnWebsite: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, fullName: true },
    });

    for (const login of TRIAL_LOGINS) {
      const isStaff = login.role === 'STAFF';
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: trialEmail(PLATFORM_TENANT_SLUG, login.role),
          name: isStaff ? (doctor?.fullName ?? login.name) : login.name,
          role: login.role,
          staffId: isStaff ? (doctor?.id ?? null) : null,
          passwordHash: await hash(login.password),
          active: true,
          mustChangePassword: false,
        },
      });
    }

    await seedHr(prisma, tenant.id);
    await seedAppointments(prisma, tenant.id);
    const owner = await prisma.user.findFirst({
      where: { tenantId: tenant.id, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const creator = owner?.id ?? 'seed';
    const library = await seedMessageLibrary(prisma, creator, tenant.id);
    const audiences = await seedAudiences(prisma, creator, tenant.id);

    console.log(
      `✓ created protected tenant ${PLATFORM_TENANT_SLUG}: ${template.services} services, ` +
        `${template.templates} message templates, ${template.demoPatients} demo patients, ` +
        `${library} library messages, ${audiences} audiences`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
