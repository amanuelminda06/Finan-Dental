import { readFile } from 'node:fs/promises';
import { seedAssetPath } from '../src/lib/seed-asset-path';
import { storage } from '../src/lib/storage';
import { runWithTenant } from '../src/lib/tenant-scope';
import { SERVICES } from '../src/config/services';
import { heroAssetForSlug } from './tenant-hero-assets';

/**
 * Static files under `public/` are seed defaults only. They are copied into the
 * tenant's own storage so every clinic owns its images and no page links to a
 * shared, branded file. New tenants get neutral images; the legacy demo tenant
 * additionally gets its logo and doctor photo.
 */
export type SeedAssetKeys = {
  heroKey: string | null;
  heroSecondaryKey: string | null;
  logoKey: string | null;
  logoDarkKey: string | null;
  doctorPhotoKey: string | null;
  serviceImageUrls: Record<string, string>;
};

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function copy(tenantId: string, source: string, key: string): Promise<string | null> {
  try {
    const bytes = await readFile(seedAssetPath(source));
    await storage.put(key, bytes);
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function seedBrandAssets(
  tenantId: string,
  options: { legacy?: boolean; slug?: string } = {},
): Promise<SeedAssetKeys> {
  // DatabaseStorage resolves the tenant from this explicit scope, so a seed or
  // CLI run can never write an image into another clinic's storage.
  return runWithTenant(tenantId, async () => {
    const heroAsset = heroAssetForSlug(options.slug);
    const heroKey = await copy(
      tenantId,
      heroAsset?.file ?? 'hero.jpg',
      heroAsset ? `${tenantId}/${heroAsset.key}` : `${tenantId}/seed-hero.jpg`,
    );
    const heroSecondaryKey = await copy(
      tenantId,
      'hero-serene-tooth.jpg',
      `${tenantId}/seed-hero-secondary.jpg`,
    );

    const serviceImageUrls: Record<string, string> = {};
    for (const service of SERVICES) {
      const file = service.imageUrl.replace(/^\//, '');
      const ext = file.split('.').pop() ?? 'jpg';
      const key = await copy(tenantId, file, `${tenantId}/service-${slug(service.nameEn)}.${ext}`);
      if (key) serviceImageUrls[service.nameEn] = `/api/uploads/${key}`;
    }

    if (!options.legacy) {
      return {
        heroKey,
        heroSecondaryKey,
        logoKey: null,
        logoDarkKey: null,
        doctorPhotoKey: null,
        serviceImageUrls,
      };
    }

    const [logoKey, logoDarkKey, doctorPhotoKey] = await Promise.all([
      copy(tenantId, 'finan-logo.png', `${tenantId}/seed-logo.png`),
      copy(tenantId, 'finan-logo-dark.png', `${tenantId}/seed-logo-dark.png`),
      copy(tenantId, 'doctors/dr-abebe-kebede.png', `${tenantId}/seed-doctor.png`),
    ]);
    return {
      heroKey,
      heroSecondaryKey,
      logoKey,
      logoDarkKey,
      doctorPhotoKey,
      serviceImageUrls,
    };
  });
}
