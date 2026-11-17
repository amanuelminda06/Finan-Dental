/**
 * Sets a tenant's `loginSecret` from LOGIN_SECRET_PATH.
 *
 *   LOGIN_SECRET_PATH=... npx tsx scripts/set-tenant-login-secret.ts finan
 *
 * The expanded tenant keeps using the clinic's existing secret login URL; the
 * migration only installs a random placeholder. Nothing is printed except the
 * tenant slug and database target — never the secret itself.
 */
import { existsSync, readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { parseTenantSlug } from '../src/lib/tenant-slug';

/** tsx does not load .env automatically — minimal loader for script runs. */
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

function databaseTarget(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const url = new URL(raw);
  return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
}

async function main(): Promise<void> {
  const slugArg = process.argv[2];
  if (!slugArg) {
    throw new Error('Usage: tsx scripts/set-tenant-login-secret.ts <tenant-slug>');
  }
  const parsed = parseTenantSlug(slugArg);
  if (!parsed.ok) throw new Error(`Invalid tenant slug "${slugArg}": ${parsed.error}`);

  const secret = process.env.LOGIN_SECRET_PATH?.trim();
  if (!secret) throw new Error('LOGIN_SECRET_PATH is not set');

  const prisma = new PrismaClient();
  try {
    console.log(`Database: ${databaseTarget()}`);
    const tenant = await prisma.tenant.update({
      where: { slug: parsed.slug },
      data: { loginSecret: secret },
      select: { slug: true, name: true },
    });
    console.log(`✓ loginSecret updated for tenant "${tenant.slug}" (${tenant.name})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
