/**
 * Assigns the starter hero image to one tenant, or to both demo tenants when
 * no slug is given.
 *
 *   npm run hero:set                     # finandentalclinic + bright-dental
 *   npm run hero:set -- finandentalclinic
 *   npm run hero:set -- bright-dental
 */
import { existsSync, readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import {
  assignTenantHero,
  HERO_TENANT_SLUGS,
  heroAssetForSlug,
} from '../prisma/tenant-hero-assets';
import { tenantHref } from '../src/lib/tenant-path';
import { brandAssetUrl } from '../src/modules/tenant-brand/defaults';

/** tsx does not load .env automatically — minimal loader like the other scripts. */
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

async function main(): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const url = new URL(raw);

  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const slugs = requested.length > 0 ? requested : [...HERO_TENANT_SLUGS];
  for (const slug of slugs) {
    if (!heroAssetForSlug(slug)) {
      throw new Error(
        `No starter hero for "${slug}". Configured slugs: ${HERO_TENANT_SLUGS.join(', ')}`,
      );
    }
  }

  console.log(`Database: ${url.hostname}:${url.port || '5432'}${url.pathname}`);
  const prisma = new PrismaClient();
  try {
    for (const slug of slugs) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { id: true, slug: true },
      });
      if (!tenant) throw new Error(`Tenant "${slug}" not found`);
      const key = await assignTenantHero(prisma, tenant);
      const url = brandAssetUrl(key);
      console.log(`✓ ${slug} hero → ${url ? tenantHref(url, slug) : 'none'}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
