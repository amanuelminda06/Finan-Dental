import type { PrismaClient } from '@prisma/client';
import { SERVICES } from '../src/config/services';
import {
  CONTENT_KEYS,
  DEFAULT_CONTENT,
  type Bilingual,
  type SiteContentKey,
} from '../src/modules/public-site/content';

/**
 * Seeds bilingual website defaults without overwriting clinic-edited copy.
 * Overrides carry the legacy demo clinic's real contact details/socials; a new
 * tenant gets the neutral placeholders only.
 */
export async function seedSiteContent(
  prisma: PrismaClient,
  tenantId: string,
  overrides: Partial<Record<SiteContentKey, Bilingual>> = {},
): Promise<{ keys: number; publicServices: number }> {
  for (const key of CONTENT_KEYS) {
    const value = overrides[key] ?? DEFAULT_CONTENT[key];
    await prisma.siteContent.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: {},
      create: { tenantId, key, valueEn: value.en, valueAm: value.am || value.en },
    });
  }

  let publicServices = 0;
  const names = SERVICES.map((service) => service.nameEn);
  for (const [displayOrder, service] of SERVICES.entries()) {
    const result = await prisma.service.updateMany({
      where: { tenantId, nameEn: service.nameEn },
      data: {
        isPublic: true,
        publicDescriptionEn: service.descriptionEn,
        publicDescriptionAm: service.descriptionAm,
        displayOrder: displayOrder + 1,
      },
    });
    publicServices += result.count;
  }
  await prisma.service.updateMany({
    where: { tenantId, nameEn: { notIn: names } },
    data: { isPublic: false },
  });

  return { keys: CONTENT_KEYS.length, publicServices };
}
