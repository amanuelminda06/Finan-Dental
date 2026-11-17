/**
 * Ensures the two tenants used by the URL-tenancy e2e/smoke checks exist on the
 * LOCAL embedded Postgres only.
 *
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/vision_erp \
 *     npx tsx scripts/seed-e2e-tenants.ts
 *
 * - default tenant (DEFAULT_TENANT_SLUG, "finan") gets the secret login path
 *   from LOGIN_SECRET_PATH so the existing flows keep working;
 * - second tenant (E2E_SECOND_TENANT, "bright-dental") gets a DIFFERENT secret
 *   so "A's login secret on B" must 404.
 *
 * Only slugs and the database target are printed — never a login secret.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { parseTenantSlug } from '../src/lib/tenant-slug';

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

async function main(): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const url = new URL(raw);
  if (url.hostname !== '127.0.0.1' || url.port !== '5433' || url.pathname !== '/vision_erp') {
    throw new Error(
      `Refusing to seed e2e tenants against ${url.hostname}:${url.port || '5432'}${url.pathname} — local embedded Postgres only`,
    );
  }
  const secret = process.env.LOGIN_SECRET_PATH?.trim();
  if (!secret) throw new Error('LOGIN_SECRET_PATH is not set');

  const primarySlug = slug(process.env.DEFAULT_TENANT_SLUG, 'finan');
  const secondSlug = slug(process.env.E2E_SECOND_TENANT, 'bright-dental');
  if (primarySlug === secondSlug) throw new Error('The two e2e tenants must have different slugs');

  console.log(`Database: ${url.hostname}:${url.port}/vision_erp`);
  const prisma = new PrismaClient();
  try {
    await prisma.tenant.upsert({
      where: { slug: primarySlug },
      update: { loginSecret: secret },
      create: { slug: primarySlug, name: 'Finan Speciality Dental Clinic', loginSecret: secret },
    });
    await prisma.tenant.upsert({
      where: { slug: secondSlug },
      update: {},
      create: {
        slug: secondSlug,
        name: 'Bright Dental (isolation test tenant)',
        loginSecret: `${secondSlug}-${randomUUID()}`,
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`✓ tenants ready: ${primarySlug}, ${secondSlug}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
