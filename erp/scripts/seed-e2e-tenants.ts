/**
 * Ensures the two tenants used by the URL-tenancy e2e/smoke checks exist on the
 * LOCAL embedded Postgres only.
 *
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/vision_erp \
 *     npx tsx scripts/seed-e2e-tenants.ts
 *
 * - protected platform tenant (DEFAULT_TENANT_SLUG, "finandentalclinic") is
 *   read only: this script never creates, overwrites or expires it;
 * - second tenant (E2E_SECOND_TENANT, "bright-dental") is created through
 *   `npm run tenant:create` with its own dental template, then given a distinct
 *   OWNER-editable brand and service name so the isolation checks can prove
 *   that nothing leaks between clinics.
 *
 * Only slugs and the database target are printed. The trial password written by
 * `tenant:create` is replaced with a deterministic local-test password; it is
 * never logged or left active. A local snapshot (default
 * `/tmp/opencode/erp-e2e-tenants.json`) gives the tests the second tenant's
 * login path and rendered messages without exposing them in `.env`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { parseTenantSlug } from '../src/lib/tenant-slug';
import { brandAssetUrl } from '../src/modules/tenant-brand/defaults';
import { previewTemplate } from '../src/modules/messaging/templates';

const E2E_OWNER_PASSWORD = 'Bright!Pass-2026';
const SECOND_CLINIC = 'Bright Dental';
const RENAMED_SERVICE = 'Bright Dental Whitening';

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

function slug(value: string | undefined, fallback: string): string {
  const parsed = parseTenantSlug(value || fallback);
  if (!parsed.ok) throw new Error(`Invalid tenant slug "${value}": ${parsed.error}`);
  return parsed.slug;
}

type TenantSnapshot = {
  slug: string;
  id: string;
  name: string;
  clinicName: string;
  loginPath: string;
  ownerEmail?: string;
  ownerPassword?: string;
  colors: { primary: string; secondary: string; accent: string };
  heroUrl: string | null;
  logoUrl: string | null;
  serviceNames: string[];
  serviceImageUrl: string | null;
  reminder: string;
};

async function snapshotTenant(
  prisma: PrismaClient,
  row: { id: string; slug: string; name: string },
  credentials?: { email: string; password: string },
): Promise<TenantSnapshot> {
  const [brand, services, clinicSetting, reminderRow] = await Promise.all([
    prisma.tenantBrand.findUnique({ where: { tenantId: row.id } }),
    prisma.service.findMany({
      where: { tenantId: row.id, active: true, isPublic: true },
      select: { nameEn: true, imageUrl: true },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.setting.findUnique({
      where: { tenantId_key: { tenantId: row.id, key: 'clinic_name' } },
      select: { value: true },
    }),
    prisma.messageTemplate.findUnique({
      where: {
        tenantId_key_language: { tenantId: row.id, key: 'APPT_REMINDER', language: 'en' },
      },
      select: { body: true },
    }),
  ]);
  if (!brand) throw new Error(`Tenant "${row.slug}" has no TenantBrand row`);

  const clinicName = brand.clinicName;
  const reminderClinic =
    typeof clinicSetting?.value === 'string' && clinicSetting.value ? clinicSetting.value : clinicName;
  const reminder = reminderRow
    ? previewTemplate(reminderRow.body, {
        clinic: reminderClinic,
        name: 'Test Patient',
        date: '2026-12-01',
        time: '10:00',
        doctor: 'Test Doctor',
      }).text
    : '';

  return {
    slug: row.slug,
    id: row.id,
    name: row.name,
    clinicName,
    loginPath: `/${row.slug}/erp/login`,
    ...(credentials ? { ownerEmail: credentials.email, ownerPassword: credentials.password } : {}),
    colors: brand.colors as { primary: string; secondary: string; accent: string },
    heroUrl: brand.heroKey ? brandAssetUrl(brand.heroKey) : null,
    logoUrl: brand.logoKey ? brandAssetUrl(brand.logoKey) : null,
    serviceNames: services.map((service) => service.nameEn),
    serviceImageUrl: services.find((service) => service.imageUrl)?.imageUrl ?? null,
    reminder,
  };
}

async function main(): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const url = new URL(raw);
  if (url.hostname !== '127.0.0.1' || url.port !== '5433' || url.pathname !== '/vision_erp') {
    throw new Error(
      `Refusing to seed e2e tenants against ${url.hostname}:${url.port || '5432'}${url.pathname} — local embedded Postgres only`,
    );
  }
  const primarySlug = slug(process.env.DEFAULT_TENANT_SLUG, 'finandentalclinic');
  const secondSlug = slug(process.env.E2E_SECOND_TENANT, 'bright-dental');
  if (primarySlug === secondSlug) throw new Error('The two e2e tenants must have different slugs');
  const ownerEmail = (process.env.E2E_SECOND_OWNER_EMAIL || `${secondSlug}-owner@example.test`)
    .trim()
    .toLowerCase();

  console.log(`Database: ${url.hostname}:${url.port}/vision_erp`);
  const prisma = new PrismaClient();
  try {
    // The protected platform tenant must already exist; e2e seeding never
    // creates, overwrites or expires it.
    const primary = await prisma.tenant.findUnique({
      where: { slug: primarySlug },
      select: { id: true, slug: true, name: true },
    });
    if (!primary) throw new Error(`Protected tenant "${primarySlug}" is missing; run the platform seed first`);

    let second = await prisma.tenant.findUnique({
      where: { slug: secondSlug },
      select: { id: true, slug: true, name: true },
    });
    if (!second) {
      const args = ['run', 'tenant:create', '--', secondSlug, SECOND_CLINIC, ownerEmail, '--demo-data'];
      try {
        execFileSync('npm', args, { cwd: process.cwd(), env: process.env, stdio: 'ignore' });
      } catch (error) {
        throw new Error(`tenant:create failed for ${secondSlug}: ${String(error)}`);
      }
      second = await prisma.tenant.findUnique({
        where: { slug: secondSlug },
        select: { id: true, slug: true, name: true },
      });
      if (!second) throw new Error(`tenant:create did not create ${secondSlug}`);
    }

    // Make the CLI-provisioned tenant deterministic for repeat e2e/smoke runs.
    // These are OWNER-style edits through the same TenantBrand/service rows the
    // ERP branding form writes; only this local script uses direct DB access.
    await prisma.user.updateMany({
      where: { tenantId: second.id, email: ownerEmail, role: 'OWNER' },
      data: { passwordHash: await hash(E2E_OWNER_PASSWORD), mustChangePassword: false },
    });
    await prisma.tenant.update({
      where: { id: second.id },
      data: { status: 'TRIAL', trialEndsAt: new Date(Date.now() + 365 * 86_400_000) },
    });
    const existingBrand = await prisma.tenantBrand.findUnique({
      where: { tenantId: second.id },
      select: {
        logoKey: true,
        logoDarkKey: true,
        heroKey: true,
        heroSecondaryKey: true,
        doctorPhotoKey: true,
      },
    });
    const distinctBrand = {
      clinicName: SECOND_CLINIC,
      shortName: 'Bright',
      tagline: 'Bright smiles, brighter days',
      address: '22 Bole Road, Addis Ababa',
      phones: ['0911222333'],
      email: 'hello@bright-dental.test',
      socials: {
        instagram: '@brightdental',
        telegram: '@brightdental',
        tiktok: '@brightdental',
        website: 'https://bright-dental.test',
      },
      smsSenderName: 'BrightSmile',
      currency: 'ETB',
      timezone: 'Africa/Addis_Ababa',
      locales: ['en', 'am'],
      colors: { primary: '#7C3AED', secondary: '#F59E0B', accent: '#FFFFFF' },
      logoKey: existingBrand?.logoKey ?? null,
      logoDarkKey: existingBrand?.logoDarkKey ?? null,
      heroKey: existingBrand?.heroKey ?? null,
      heroSecondaryKey: existingBrand?.heroSecondaryKey ?? null,
      doctorPhotoKey: existingBrand?.doctorPhotoKey ?? null,
      trialBanner: true,
      trialBannerText: 'Bright Dental — demo clinic',
    };
    await prisma.tenantBrand.upsert({
      where: { tenantId: second.id },
      update: distinctBrand,
      create: { tenantId: second.id, ...distinctBrand },
    });
    await prisma.setting.upsert({
      where: { tenantId_key: { tenantId: second.id, key: 'clinic_name' } },
      update: { value: SECOND_CLINIC },
      create: { tenantId: second.id, key: 'clinic_name', value: SECOND_CLINIC },
    });
    await prisma.service.updateMany({
      where: { tenantId: second.id, nameEn: { in: ['Free Consultation', RENAMED_SERVICE] } },
      data: {
        name: RENAMED_SERVICE,
        nameEn: RENAMED_SERVICE,
        nameAm: 'የብሩህ ጥርስ ነጣ ማድረግ',
        publicDescriptionEn: 'A Bright Dental signature whitening consultation.',
        publicDescriptionAm: 'የብሩህ የጥርስ ነጣ ማድረግ ምክክር።',
      },
    });

    const [a, b] = await Promise.all([
      snapshotTenant(prisma, primary),
      snapshotTenant(prisma, second, { email: ownerEmail, password: E2E_OWNER_PASSWORD }),
    ]);
    const snapshot = {
      generatedAt: new Date().toISOString(),
      database: `${url.hostname}:${url.port || '5432'}${url.pathname}`,
      tenants: { [primarySlug]: a, [secondSlug]: b },
    };
    const snapshotPath = process.env.E2E_TENANT_SNAPSHOT ?? '/tmp/opencode/erp-e2e-tenants.json';
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });

    console.log(`✓ tenants ready: ${primarySlug}, ${secondSlug}`);
    console.log(`✓ local snapshot: ${snapshotPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
