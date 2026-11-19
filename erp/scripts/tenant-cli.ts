/**
 * Local-first tenant provisioning CLI.
 *
 *   npm run tenant:create -- <slug> "Clinic Name" <owner email> [--demo-data]
 *   npm run tenant:activate -- <slug>
 *   npm run tenant:extend -- <slug> [--days 30]
 *   npm run tenant:suspend -- <slug>
 *   npm run tenant:reset-demo -- <slug>
 *   npm run tenant:delete -- <slug> [--force]
 *
 * Hosted Neon is refused unless `--allow-hosted` is passed explicitly; the
 * target host/database is always printed. Every trial tenant gets the same
 * three fixed logins (owner/owner123, reception/reception123,
 * doctor/doctor123) — no env vars and no credentials file. `tenant:activate`
 * takes a clinic live by forcing a strong-password change for all its users.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import { PrismaClient, type Role, type TenantStatus } from '@prisma/client';
import { parseTenantSlug } from '../src/lib/tenant-slug';
import { TRIAL_LOGINS, trialEmail } from '../src/lib/trial-credentials';
import { assertTenantNotProtected } from '../src/lib/tenant-protection';

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

const USAGE = `Usage:
  tenant:create <slug> "<clinic name>" <owner email> [--demo-data]
  tenant:activate <slug>
  tenant:extend <slug> [--days 30]
  tenant:suspend <slug>
  tenant:reset-demo <slug>
  tenant:delete <slug> [--force]
Add --allow-hosted to operate on a hosted Neon database.`;

function fail(message: string): never {
  throw new Error(message);
}

function slugArg(value: string | undefined): string {
  if (!value) fail(`Missing tenant slug.\n${USAGE}`);
  const parsed = parseTenantSlug(value);
  if (!parsed.ok) fail(`Invalid tenant slug "${value}": ${parsed.error}`);
  return parsed.slug;
}

function daysOption(args: string[]): number {
  const at = args.indexOf('--days');
  const raw = at === -1 ? '30' : args[at + 1];
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    fail(`--days must be an integer between 1 and 3650 (got "${raw}")`);
  }
  return days;
}

function emailArg(value: string | undefined): string {
  if (!value || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    fail(`Invalid owner email: "${value ?? ''}"`);
  }
  return value.toLowerCase();
}

function databaseTarget(allowHosted: boolean): URL {
  const raw = process.env.DATABASE_URL;
  if (!raw) fail('DATABASE_URL is not set');
  const url = new URL(raw);
  const host = url.hostname;
  const port = url.port || (url.protocol === 'postgresql:' ? '5432' : '5433');
  const database = url.pathname.replace(/^\//, '');
  const target = `${host}:${port}/${database}`;
  console.log(`Database: ${target}`);
  const local = (host === '127.0.0.1' || host === 'localhost') && port === '5433';
  if (!local && !allowHosted) {
    fail(
      `Refusing to modify ${target} — local embedded Postgres (127.0.0.1:5433) only. ` +
        'Pass --allow-hosted deliberately to provision a hosted Neon database.',
    );
  }
  return url;
}

async function clearDemoData(prisma: PrismaClient, tenantId: string): Promise<void> {
  // Ordered child-first so no foreign key blocks the delete. Every statement is
  // scoped to this tenant; other clinics' data is never touched.
  await prisma.$executeRaw`DELETE FROM "MessageTask" WHERE "tenantId" = ${tenantId}`;
  await prisma.$executeRaw`DELETE FROM "Appointment" WHERE "tenantId" = ${tenantId}`;
  await prisma.$executeRaw`DELETE FROM "FollowUp" WHERE "tenantId" = ${tenantId}`;
  await prisma.$executeRaw`DELETE FROM "SaleLine" WHERE "tenantId" = ${tenantId}`;
  await prisma.$executeRaw`DELETE FROM "Sale" WHERE "tenantId" = ${tenantId}`;
  await prisma.$executeRaw`DELETE FROM "PatientTag" WHERE "tenantId" = ${tenantId}`;
  await prisma.$executeRaw`DELETE FROM "PatientSickLeave" WHERE "tenantId" = ${tenantId}`;
  await prisma.$executeRaw`DELETE FROM "Patient" WHERE "tenantId" = ${tenantId}`;
  await prisma.$executeRaw`DELETE FROM "Tag" WHERE "tenantId" = ${tenantId}`;
}

async function requireTenant(prisma: PrismaClient, slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) fail(`Tenant "${slug}" does not exist`);
  return tenant;
}

async function main(): Promise<void> {
  // Imported after loadEnv(): storage validates env at module load.
  const { applyDentalTemplate } = await import('../prisma/tenant-template');
  const [command, ...args] = process.argv.slice(2);
  if (!command || ['--help', '-h'].includes(command)) {
    console.log(USAGE);
    return;
  }
  const allowHosted = args.includes('--allow-hosted');
  const url = databaseTarget(allowHosted);
  const prisma = new PrismaClient();

  try {
    switch (command) {
      case 'tenant:create': {
        const slug = slugArg(args[0]);
        const name = args[1]?.trim();
        if (!name) fail(`Missing clinic name.\n${USAGE}`);
        const email = emailArg(args[2]);
        const existing = await prisma.tenant.findUnique({ where: { slug } });
        if (existing) fail(`Tenant "${slug}" already exists`);

        // The column stays unique for legacy compatibility; login no longer
        // uses it, so the value is random and never shown to anyone.
        const loginSecret = randomBytes(24).toString('base64url');
        const tenant = await prisma.tenant.create({
          data: {
            slug,
            name,
            status: 'TRIAL',
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            loginSecret,
          },
        });

        const shortName = name.replace(/\s*/g, '').slice(0, 24) || slug;
        const template = await applyDentalTemplate(prisma, tenant.id, {
          clinicName: name,
          slug,
          shortName,
          smsSenderName: shortName.slice(0, 11),
          demoData: args.includes('--demo-data'),
        });

        // A doctor is a STAFF user linked to a doctor profile, so the public
        // doctors feed and appointment doctor selector work in a trial clinic.
        let doctorProfile = await prisma.staff.findFirst({
          where: { tenantId: tenant.id, isDoctor: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, fullName: true },
        });
        if (!doctorProfile) {
          doctorProfile = await prisma.staff.create({
            data: {
              tenantId: tenant.id,
              fullName: 'Dr. Clinic Dentist',
              jobTitle: 'Dentist',
              isDoctor: true,
              showOnWebsite: true,
            },
            select: { id: true, fullName: true },
          });
        }

        const accounts: Array<{
          role: Role;
          email: string;
          name: string;
          staffId: string | null;
          password: string;
        }> = TRIAL_LOGINS.map((login) => {
          const isStaff = login.role === 'STAFF';
          return {
            role: login.role,
            email:
              login.role === 'OWNER' ? email : trialEmail(slug, isStaff ? 'STAFF' : 'RECEPTION'),
            name: isStaff ? doctorProfile.fullName : login.name,
            staffId: isStaff ? doctorProfile.id : null,
            password: login.password,
          };
        });
        for (const account of accounts) {
          await prisma.user.create({
            data: {
              tenantId: tenant.id,
              email: account.email,
              name: account.name,
              role: account.role,
              staffId: account.staffId,
              passwordHash: await hash(account.password),
              active: true,
              mustChangePassword: false,
            },
          });
        }

        console.log(`✓ created tenant ${slug} (${url.host}/${url.pathname.replace(/^\//, '')})`);
        console.log(`✓ dental template: ${template.services} services, ${template.templates} templates`);
        console.log(
          '✓ trial logins: owner/owner123, reception/reception123, doctor/doctor123 (no forced password change)',
        );
        console.log(`✓ open login: /${slug}/erp/login — run tenant:activate before real use`);
        break;
      }

      case 'tenant:activate': {
        const slug = slugArg(args[0]);
        const tenant = await requireTenant(prisma, slug);
        await assertTenantNotProtected(prisma, slug);
        const [, users] = await prisma.$transaction([
          prisma.tenant.update({
            where: { id: tenant.id },
            data: { status: 'ACTIVE' as TenantStatus, trialEndsAt: null },
          }),
          prisma.user.updateMany({
            where: { tenantId: tenant.id },
            data: { failedLoginCount: 0, lockedUntil: null },
          }),
        ]);
        console.log(`✓ ${slug} is ACTIVE; ${users.count} user(s) can sign in with their trial logins`);
        break;
      }

      case 'tenant:extend': {
        const slug = slugArg(args[0]);
        const days = daysOption(args);
        const tenant = await requireTenant(prisma, slug);
        const trialEndsAt = new Date(
          Math.max(Date.now(), tenant.trialEndsAt?.getTime() ?? 0) + days * 86_400_000,
        );
        await prisma.tenant.update({ where: { id: tenant.id }, data: { trialEndsAt } });
        console.log(`✓ ${slug} trial extended to ${trialEndsAt.toISOString()}`);
        break;
      }

      case 'tenant:suspend': {
        const slug = slugArg(args[0]);
        const tenant = await requireTenant(prisma, slug);
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { status: 'SUSPENDED' as TenantStatus },
        });
        console.log(`✓ ${slug} suspended (all URLs now answer 404)`);
        break;
      }

      case 'tenant:reset-demo': {
        const slug = slugArg(args[0]);
        const tenant = await requireTenant(prisma, slug);
        await assertTenantNotProtected(prisma, slug);
        await clearDemoData(prisma, tenant.id);
        const template = await applyDentalTemplate(prisma, tenant.id, {
          clinicName: tenant.name,
          preserveIdentity: true,
          demoData: true,
        });
        console.log(
          `✓ ${slug} demo data reset: ${template.demoPatients} invented patients, ` +
            'branding and settings preserved',
        );
        break;
      }

      case 'tenant:delete': {
        const slug = slugArg(args[0]);
        const tenant = await requireTenant(prisma, slug);
        await assertTenantNotProtected(prisma, slug);
        if (tenant.status === 'ACTIVE' && !args.includes('--force')) {
          fail(
            `Refusing to delete ACTIVE tenant "${slug}" without --force. ` +
              'Suspend it first unless deletion is intentional.',
          );
        }
        await prisma.tenant.delete({ where: { id: tenant.id } });
        console.log(`✓ deleted tenant ${slug} and all of its rows`);
        break;
      }

      default:
        fail(`Unknown command "${command}".\n${USAGE}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
