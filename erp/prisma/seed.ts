import { existsSync, readFileSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import { TRIAL_LOGINS, trialEmail } from '../src/lib/trial-credentials';
import { ensureSeedTenant } from './seed-tenant';

/** tsx does not load .env automatically — minimal loader for seed runs. */
function loadEnv(): void {
  const url = new URL('../.env', import.meta.url);
  if (!existsSync(url)) return;
  for (const line of readFileSync(url, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

loadEnv();

async function main(): Promise<void> {
  // Fail fast on bad/missing env (validated by src/env.ts).
  const { env } = await import('../src/env');
  const { PrismaClient } = await import('@prisma/client');
  const { applyDentalTemplate } = await import('./tenant-template');
  const { seedHr } = await import('./seed-hr');
  const { seedAppointments } = await import('./seed-appointments');
  const { seedMessageLibrary, seedAudiences } = await import('./seed-library');
  const prisma = new PrismaClient();

  try {
    const tenantId = await ensureSeedTenant(prisma);

    const template = await applyDentalTemplate(prisma, tenantId, {
      clinicName: 'Finan Speciality Dental Clinic',
      slug: env.DEFAULT_TENANT_SLUG,
      legacy: true,
      demoData: process.env.SEED_DEMO_DATA === 'true',
    });
    console.log(
      `✓ dental template: ${template.services} services, ${template.templates} message templates, ` +
        `${template.content} site-content keys, ${template.demoPatients} demo patients`,
    );

    const doctor = await prisma.staff.findFirst({
      where: { tenantId, isDoctor: true, showOnWebsite: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, fullName: true },
    });

    // Fixed trial logins are role-based. Reset the existing account for each
    // role so re-seeding never leaves duplicate owners/staff behind.
    for (const login of TRIAL_LOGINS) {
      const isStaff = login.role === 'STAFF';
      const data = {
        name: isStaff ? (doctor?.fullName ?? login.name) : login.name,
        passwordHash: await hash(login.password),
        role: login.role,
        staffId: isStaff ? (doctor?.id ?? null) : null,
        active: true,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      };
      const existing = await prisma.user.findFirst({
        where: { tenantId, role: login.role },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (existing) {
        await prisma.user.update({ where: { id: existing.id }, data });
      } else {
        await prisma.user.create({
          data: { tenantId, email: trialEmail(env.DEFAULT_TENANT_SLUG, login.role), ...data },
        });
      }
      console.log(`✓ login ${login.shortName} (${login.role})`);
    }

    // --- HR: staff, shifts, templates, leave (idempotent) ---
    await seedHr(prisma);

    // --- Appointments, website requests, follow-ups (idempotent) ---
    await seedAppointments(prisma);

    // --- Message library + saved audiences (idempotent) ---
    const owner = await prisma.user.findFirst({
      where: { tenantId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const library = await seedMessageLibrary(prisma, owner?.id ?? 'seed');
    const audiences = await seedAudiences(prisma, owner?.id ?? 'seed');
    console.log(`✓ ${library} library messages, ${audiences} saved audiences`);

    console.log('Seed complete.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
