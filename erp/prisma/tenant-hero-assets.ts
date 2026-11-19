import { readFile } from 'node:fs/promises';
import type { PrismaClient } from '@prisma/client';
import { seedAssetPath } from '../src/lib/seed-asset-path';
import { storage } from '../src/lib/storage';
import { runWithTenant } from '../src/lib/tenant-scope';

/**
 * Starter hero images for the two demo tenants. Files in `public/` are seed
 * defaults only: each tenant gets its own copy in tenant-scoped storage, and
 * `TenantBrand.heroKey` points at that copy (never at a shared public file).
 */
export type TenantHeroAsset = {
  file: string;
  key: string;
};

const HERO_ASSETS: Record<string, TenantHeroAsset> = {
  finandentalclinic: {
    file: 'hero-finan-dental.jpg',
    key: 'seed-hero-finan-dental.jpg',
  },
  'bright-dental': {
    file: 'hero-bright-dental.jpg',
    key: 'seed-hero-bright-dental.jpg',
  },
};

export const HERO_TENANT_SLUGS = Object.freeze(Object.keys(HERO_ASSETS));

export function heroAssetForSlug(slug: string | undefined): TenantHeroAsset | null {
  if (!slug) return null;
  return HERO_ASSETS[slug] ?? null;
}

/**
 * Replace one tenant's hero with its starter image, keeping the tenant's stored
 * bytes and `TenantBrand.heroKey` in sync. Safe to rerun: the key is stable and
 * unchanged bytes are left alone.
 */
export async function assignTenantHero(
  prisma: PrismaClient,
  tenant: { id: string; slug: string },
): Promise<string> {
  const asset = heroAssetForSlug(tenant.slug);
  if (!asset) throw new Error(`No starter hero image configured for tenant "${tenant.slug}"`);

  const bytes = await readFile(seedAssetPath(asset.file));
  const key = `${tenant.id}/${asset.key}`;

  // DatabaseStorage resolves the tenant from this explicit scope, so a seed or
  // CLI run can never write or remove an image in another clinic's storage.
  return runWithTenant(tenant.id, async () => {
    const brand = await prisma.tenantBrand.findUnique({
      where: { tenantId: tenant.id },
      select: { heroKey: true },
    });
    if (!brand) throw new Error(`Tenant "${tenant.slug}" has no TenantBrand row`);

    const existing = await storage.get(key);
    if (!existing || !existing.equals(bytes)) {
      await storage.remove(key);
      await storage.put(key, bytes);
    }

    await prisma.tenantBrand.update({
      where: { tenantId: tenant.id },
      data: { heroKey: key },
    });
    if (brand.heroKey && brand.heroKey !== key) await storage.remove(brand.heroKey);

    return key;
  });
}
