import { existsSync, readFileSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
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

    const users = [
      {
        email: env.OWNER_EMAIL.toLowerCase(),
        name: 'Clinic Owner',
        role: 'OWNER' as const,
        password: env.OWNER_PASSWORD,
        staffId: null,
      },
      {
        email: env.RECEPTION_EMAIL.toLowerCase(),
        name: 'Reception Desk',
        role: 'RECEPTION' as const,
        password: env.RECEPTION_PASSWORD,
        staffId: null,
      },
      {
        email: env.STAFF_EMAIL.toLowerCase(),
        name: doctor?.fullName ?? 'Clinic Dentist',
        role: 'STAFF' as const,
        password: env.STAFF_PASSWORD,
        staffId: doctor?.id ?? null,
      },
    ];

    for (const user of users) {
      const passwordHash = await hash(user.password);
      const data = {
        name: user.name,
        passwordHash,
        role: user.role,
        staffId: user.staffId,
        active: true,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      };
      await prisma.user.upsert({
        where: { tenantId_email: { tenantId, email: user.email } },
        update: data,
        create: { tenantId, email: user.email, ...data },
      });
      console.log(`✓ user ${user.email} (${user.role})`);
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
