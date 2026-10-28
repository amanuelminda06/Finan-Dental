import type { PrismaClient } from '@prisma/client';
import { SERVICES } from '../src/config/services';
import { CONTENT_KEYS, DEFAULT_CONTENT } from '../src/modules/public-site/content';

/** Seed bilingual website defaults without overwriting clinic-edited copy. */
export async function seedSiteContent(
  prisma: PrismaClient,
): Promise<{ keys: number; publicServices: number }> {
  for (const key of CONTENT_KEYS) {
    const value = DEFAULT_CONTENT[key];
    await prisma.siteContent.upsert({
      where: { key },
      update: {},
      create: { key, valueEn: value.en, valueAm: value.am },
    });
  }

  let publicServices = 0;
  for (const [displayOrder, service] of SERVICES.entries()) {
    const result = await prisma.service.updateMany({
      where: { nameEn: service.nameEn },
      data: {
        isPublic: true,
        publicDescriptionEn: service.descriptionEn,
        publicDescriptionAm: service.descriptionAm,
        displayOrder: displayOrder + 1,
      },
    });
    publicServices += result.count;
  }

  return { keys: CONTENT_KEYS.length, publicServices };
}
