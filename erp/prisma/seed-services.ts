import type { PrismaClient } from '@prisma/client';
import { SERVICES } from '../src/config/services';

/**
 * Seeds the dental service catalogue for ONE tenant. Images are copied into
 * that tenant's storage by `seedBrandAssets`; a static `/services/…` path is
 * only a last-resort fallback for an old row whose copy could not be made.
 */
export async function seedServicesAndSales(
  prisma: PrismaClient,
  tenantId: string,
  imageUrls: Record<string, string> = {},
): Promise<void> {
  const existing = await prisma.service.findMany({
    where: { tenantId },
    select: { id: true, name: true, nameEn: true, imageUrl: true },
  });

  for (const [index, seed] of SERVICES.entries()) {
    const found = existing.find(
      (service) => service.nameEn === seed.nameEn || service.name === seed.nameEn,
    );
    // Always prefer the tenant-owned copy. Existing rows keep an uploaded image
    // only when the OWNER replaced the seeded one through the ERP.
    const imageUrl =
      found?.imageUrl?.startsWith('/api/uploads/') ? found.imageUrl : imageUrls[seed.nameEn] ?? null;
    const data = {
      name: seed.nameEn,
      nameEn: seed.nameEn,
      nameAm: seed.nameAm,
      category: seed.category,
      currentPrice: seed.price === null ? null : String(seed.price),
      active: true,
      isPublic: true,
      publicDescriptionEn: seed.descriptionEn,
      publicDescriptionAm: seed.descriptionAm,
      displayOrder: index + 1,
      imageUrl,
      receiptLabelEn: null,
      receiptLabelAm: null,
    };
    if (found) {
      await prisma.service.update({ where: { id: found.id }, data });
    } else {
      await prisma.service.create({ data: { tenantId, ...data } });
    }
  }

  const names = SERVICES.map((service) => service.nameEn);
  // Remove leftover (e.g. optical/eye) services for this clinic only.
  const obsolete = await prisma.service.findMany({
    where: { tenantId, nameEn: { notIn: names } },
    select: { id: true },
  });
  if (obsolete.length) {
    const ids = obsolete.map((service) => service.id);
    await prisma.saleLine.deleteMany({ where: { tenantId, serviceId: { in: ids } } });
    await prisma.servicePriceHistory.deleteMany({ where: { tenantId, serviceId: { in: ids } } });
    await prisma.service.deleteMany({ where: { tenantId, id: { in: ids } } });
  }
}
