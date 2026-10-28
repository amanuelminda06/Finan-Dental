import type { PrismaClient } from '@prisma/client';
import { SERVICES } from '../src/config/services';
export async function seedServicesAndSales(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.service.findMany({
    select: { id: true, name: true, nameEn: true, currentPrice: true },
  });

  for (const [index, seed] of SERVICES.entries()) {
    const found = existing.find((service) => service.nameEn === seed.nameEn || service.name === seed.nameEn);
    const descriptionEn = seed.descriptionEn;
    const descriptionAm = seed.descriptionAm;
    if (found) {
      await prisma.service.update({
        where: { id: found.id },
        data: {
          name: seed.nameEn,
          nameEn: seed.nameEn,
          nameAm: seed.nameAm,
          category: seed.category,
          currentPrice: seed.price === 0 ? '0.00' : null,
          active: true,
          isPublic: true,
          publicDescriptionEn: descriptionEn,
          publicDescriptionAm: descriptionAm,
          displayOrder: index + 1,
          imageUrl: null,
          receiptLabelEn: null,
          receiptLabelAm: null,
        },
      });
    } else {
      await prisma.service.create({
        data: {
          name: seed.nameEn,
          nameEn: seed.nameEn,
          nameAm: seed.nameAm,
          category: seed.category,
          currentPrice: seed.price === null ? null : String(seed.price),
          active: true,
          isPublic: true,
          publicDescriptionEn: descriptionEn,
          publicDescriptionAm: descriptionAm,
          displayOrder: index + 1,
        },
      });
    }
  }

  const finanNames = SERVICES.map((service) => service.nameEn);
  // Remove leftover (e.g. optical/eye) services that are no longer in the catalog.
  const obsolete = await prisma.service.findMany({
    where: { nameEn: { notIn: finanNames } },
    select: { id: true },
  });
  if (obsolete.length) {
    const obsoleteIds = obsolete.map((s) => s.id);
    await prisma.saleLine.deleteMany({ where: { serviceId: { in: obsoleteIds } } });
    await prisma.service.deleteMany({ where: { id: { in: obsoleteIds } } });
  }
  await prisma.service.updateMany({
    where: { nameEn: { notIn: finanNames } },
    data: { active: false, isPublic: false },
  });

  // Demo sales are deliberately not generated: they would imply unprovided fees.
  const salesCount = await prisma.sale.count();
  console.log(`✓ ${SERVICES.length} clinic services seeded; existing sales preserved (${salesCount})`);
}
