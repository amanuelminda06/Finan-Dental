'use server';

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { storage } from '@/lib/storage';
import { getTenantId } from '@/lib/tenant-context';
import { writeAudit } from '@/lib/audit';
import { ok, withAuth, type ActionResult } from '@/lib/action';
import { validate } from '@/lib/errors';
import { brandingFormSchema, parsePhones } from './schemas';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const CONTENT_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const IMAGE_FIELDS = ['logo', 'logoDark', 'hero', 'heroSecondary', 'doctorPhoto'] as const;
type ImageField = (typeof IMAGE_FIELDS)[number];

async function storeBrandImage(file: File, field: ImageField, tenantId: string): Promise<string> {
  const ext = CONTENT_TYPES[file.type];
  if (!ext) throw new Error(`Invalid image type for ${field}`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`Image too large for ${field}`);
  const key = `${tenantId}/brand-${field}-${randomUUID()}.${ext}`;
  await storage.put(key, Buffer.from(await file.arrayBuffer()));
  return key;
}

function imageFromFile(formData: FormData, field: ImageField): File | null {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

/**
 * Persists every OWNER-editable identity/brand field for the current clinic.
 * Images go to tenant-owned storage; only their keys are stored on the brand
 * row, so an image from another tenant can never be referenced.
 */
export async function saveTenantBrandAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return withAuth(['OWNER'], async (actor) => {
    const raw = {
      clinicName: String(formData.get('clinicName') ?? ''),
      shortName: String(formData.get('shortName') ?? ''),
      tagline: String(formData.get('tagline') ?? ''),
      address: String(formData.get('address') ?? ''),
      phones: String(formData.get('phones') ?? ''),
      email: String(formData.get('email') ?? ''),
      instagram: String(formData.get('instagram') ?? ''),
      telegram: String(formData.get('telegram') ?? ''),
      tiktok: String(formData.get('tiktok') ?? ''),
      website: String(formData.get('website') ?? ''),
      smsSenderName: String(formData.get('smsSenderName') ?? ''),
      currency: String(formData.get('currency') ?? ''),
      timezone: String(formData.get('timezone') ?? ''),
      locales: formData.getAll('locales').map(String),
      colorPrimary: String(formData.get('colorPrimary') ?? ''),
      colorSecondary: String(formData.get('colorSecondary') ?? ''),
      colorAccent: String(formData.get('colorAccent') ?? ''),
      doctorName: String(formData.get('doctorName') ?? ''),
      doctorTitle: String(formData.get('doctorTitle') ?? ''),
      doctorBio: String(formData.get('doctorBio') ?? ''),
      trialBanner: String(formData.get('trialBanner') ?? '') === 'true',
      trialBannerText: String(formData.get('trialBannerText') ?? ''),
    };
    const values = validate(brandingFormSchema, raw);
    const tenantId = await getTenantId();

    const before = await prisma.tenantBrand.findUnique({
      where: { tenantId },
      select: {
        logoKey: true,
        logoDarkKey: true,
        heroKey: true,
        heroSecondaryKey: true,
        doctorPhotoKey: true,
      },
    });

    const uploads: Partial<Record<ImageField, string>> = {};
    for (const field of IMAGE_FIELDS) {
      const file = imageFromFile(formData, field);
      if (file) uploads[field] = await storeBrandImage(file, field, tenantId);
    }

    const keyFor = (field: ImageField): string | null =>
      uploads[field] ?? before?.[`${field}Key` as keyof typeof before] ?? null;

    const data = {
      clinicName: values.clinicName,
      shortName: values.shortName,
      tagline: values.tagline,
      address: values.address,
      phones: parsePhones(values.phones),
      email: values.email,
      socials: {
        instagram: values.instagram,
        telegram: values.telegram,
        tiktok: values.tiktok,
        website: values.website,
      },
      smsSenderName: values.smsSenderName,
      currency: values.currency,
      timezone: values.timezone,
      locales: values.locales,
      colors: {
        primary: values.colorPrimary,
        secondary: values.colorSecondary,
        accent: values.colorAccent,
      },
      logoKey: keyFor('logo'),
      logoDarkKey: keyFor('logoDark'),
      heroKey: keyFor('hero'),
      heroSecondaryKey: keyFor('heroSecondary'),
      doctorName: values.doctorName,
      doctorTitle: values.doctorTitle,
      doctorBio: values.doctorBio,
      doctorPhotoKey: keyFor('doctorPhoto'),
      trialBanner: values.trialBanner,
      trialBannerText: values.trialBannerText,
    };

    await prisma.tenantBrand.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data },
    });

    for (const field of IMAGE_FIELDS) {
      const oldKey = before?.[`${field}Key` as keyof typeof before];
      if (uploads[field] && oldKey && oldKey !== uploads[field]) {
        await storage.remove(oldKey).catch(() => undefined);
      }
    }

    await writeAudit({
      user: actor,
      entity: 'TenantBrand',
      entityId: tenantId,
      action: 'BRAND_UPDATED',
      new: { clinicName: data.clinicName, smsSenderName: data.smsSenderName },
    });
    return ok();
  });
}
