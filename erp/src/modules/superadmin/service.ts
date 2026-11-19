import { randomUUID } from 'node:crypto';
import { Prisma, type TenantStatus } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { basePrisma } from '@/lib/prisma-base';
import { storage } from '@/lib/storage';
import { parseTenantSlug } from '@/lib/tenant-slug';
import { assertTenantIdNotProtected } from '@/lib/tenant-protection';
import { applyDentalTemplate } from '../../../prisma/tenant-template';
import { TRIAL_LOGINS, trialEmail } from '@/lib/trial-credentials';
import { neutralTenantBrand, type TenantBrandData } from '@/modules/tenant-brand/defaults';
import { normalizeTenantBrand } from '@/modules/tenant-brand/queries';
import {
  brandingFormSchema,
  parsePhones,
  type BrandingFormValues,
} from '@/modules/tenant-brand/schemas';
import { resolveContent, type SiteContentMap } from '@/modules/public-site/content';
import { settingsFromMap } from '@/modules/settings/queries';
import {
  SETTING_KEYS,
  toSettingValues,
  WEEKDAYS,
  type SettingsFormValues,
} from '@/modules/settings/schemas';

/** Everything the platform UI needs for a tenant, resolved by explicit tenant id only. */
export type SuperadminTenant = {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  trialEndsAt: string | null;
  protected: boolean;
  clinicName: string;
  counts: { users: number; patients: number; appointments: number };
};

export type TenantEditData = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
    trialEndsAt: string | null;
    protected: boolean;
  };
  brand: TenantBrandData;
  content: SiteContentMap;
  settings: SettingsFormValues;
};

export class SuperadminError extends Error {}

function notFound(slug: string): never {
  throw new SuperadminError(`Tenant "${slug}" does not exist`);
}

async function findTenant(slug: string) {
  const tenant = await basePrisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound(slug);
  return tenant;
}

async function audit(tenantId: string, action: string): Promise<void> {
  await basePrisma.auditLog.create({
    data: {
      tenantId,
      entity: 'Tenant',
      entityId: tenantId,
      action,
      userId: null,
      oldJson: Prisma.JsonNull,
      newJson: Prisma.JsonNull,
      ip: null,
    },
  });
}

export async function listTenants(): Promise<SuperadminTenant[]> {
  const rows = await basePrisma.tenant.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      brand: { select: { clinicName: true } },
      _count: { select: { users: true, patients: true, appointments: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    trialEndsAt: row.trialEndsAt ? row.trialEndsAt.toISOString() : null,
    protected: row.protected,
    clinicName: row.brand?.clinicName ?? row.name,
    counts: row._count,
  }));
}

export async function getTenantEditData(slug: string): Promise<TenantEditData | null> {
  const tenant = await basePrisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return null;
  const [brandRow, contentRows, settingRows] = await Promise.all([
    basePrisma.tenantBrand.findUnique({ where: { tenantId: tenant.id } }),
    basePrisma.siteContent.findMany({
      where: { tenantId: tenant.id },
      select: { key: true, valueEn: true, valueAm: true },
    }),
    basePrisma.setting.findMany({
      where: { tenantId: tenant.id },
      select: { key: true, value: true },
    }),
  ]);
  const map: Record<string, unknown> = Object.fromEntries(
    settingRows.map((row) => [row.key, row.value]),
  );
  if (typeof map.clinic_name !== 'string' || !map.clinic_name) {
    map.clinic_name = brandRow?.clinicName ?? tenant.name;
  }
  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.toISOString() : null,
      protected: tenant.protected,
    },
    brand: brandRow
      ? normalizeTenantBrand(brandRow)
      : neutralTenantBrand({
          clinicName: tenant.name,
          shortName: tenant.slug,
          smsSenderName: tenant.slug.slice(0, 11),
        }),
    content: resolveContent(contentRows),
    settings: settingsFromMap(map),
  };
}

export async function createTenant(input: {
  slug: string;
  name: string;
  ownerEmail: string;
  demoData: boolean;
}): Promise<void> {
  const parsed = parseTenantSlug(input.slug);
  if (!parsed.ok) throw new SuperadminError(`Invalid tenant slug: ${input.slug}`);
  if (!input.name.trim()) throw new SuperadminError('Clinic name is required');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.ownerEmail.trim())) {
    throw new SuperadminError('A valid owner email is required');
  }
  if (await basePrisma.tenant.findUnique({ where: { slug: parsed.slug } })) {
    throw new SuperadminError(`Tenant "${parsed.slug}" already exists`);
  }

  // Random legacy-uniqueness value; login never uses it.
  const loginSecret = randomBytes24();
  const tenant = await basePrisma.tenant.create({
    data: {
      slug: parsed.slug,
      name: input.name.trim(),
      status: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
      loginSecret,
    },
  });

  await applyDentalTemplate(basePrisma, tenant.id, {
    clinicName: tenant.name,
    slug: tenant.slug,
    shortName: tenant.name.replace(/\s*/g, '').slice(0, 24) || tenant.slug,
    smsSenderName: (tenant.name.replace(/\s*/g, '').slice(0, 24) || tenant.slug).slice(0, 11),
    demoData: input.demoData,
  });

  const doctor =
    (await basePrisma.staff.findFirst({
      where: { tenantId: tenant.id, isDoctor: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, fullName: true },
    })) ??
    (await basePrisma.staff.create({
      data: {
        tenantId: tenant.id,
        fullName: 'Dr. Clinic Dentist',
        jobTitle: 'Dentist',
        isDoctor: true,
        showOnWebsite: true,
      },
      select: { id: true, fullName: true },
    }));

  for (const login of TRIAL_LOGINS) {
    const isStaff = login.role === 'STAFF';
    await basePrisma.user.create({
      data: {
        tenantId: tenant.id,
        email:
          login.role === 'OWNER'
            ? input.ownerEmail.trim()
            : trialEmail(tenant.slug, isStaff ? 'STAFF' : 'RECEPTION'),
        name: isStaff ? doctor.fullName : login.name,
        role: login.role,
        staffId: isStaff ? doctor.id : null,
        passwordHash: await hash(login.password),
        active: true,
        mustChangePassword: false,
      },
    });
  }
  await audit(tenant.id, 'TENANT_CREATED');
}

function randomBytes24(): string {
  // Small wrapper so the caller stays readable; no values are ever logged.
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 8);
}

export async function updateTenant(
  slug: string,
  input: { name: string; newSlug: string; status: TenantStatus; trialEndsAt: string | null },
): Promise<void> {
  const tenant = await findTenant(slug);
  if (!input.name.trim()) throw new SuperadminError('Clinic name is required');
  const parsed = parseTenantSlug(input.newSlug);
  if (!parsed.ok) throw new SuperadminError(`Invalid tenant slug: ${input.newSlug}`);
  const clash = await basePrisma.tenant.findUnique({ where: { slug: parsed.slug } });
  if (clash && clash.id !== tenant.id) {
    throw new SuperadminError(`Tenant "${parsed.slug}" already exists`);
  }
  // The platform-owned clinic keeps its stable URL and must never expire or be
  // suspended through any surface, including this one. Branding/content edits
  // are still allowed; only its lifecycle identity is locked.
  if (
    tenant.protected &&
    (parsed.slug !== tenant.slug || input.status !== 'ACTIVE' || input.trialEndsAt !== null)
  ) {
    throw new SuperadminError(
      'The protected tenant must stay ACTIVE with its original slug and no expiry',
    );
  }
  await basePrisma.tenant.update({
    where: { id: tenant.id },
    data: {
      name: input.name.trim(),
      slug: parsed.slug,
      status: input.status,
      trialEndsAt: input.trialEndsAt ? new Date(input.trialEndsAt) : null,
    },
  });
  await audit(tenant.id, 'TENANT_UPDATED');
}

export async function activateTenant(slug: string): Promise<void> {
  const tenant = await findTenant(slug);
  await assertTenantIdNotProtected(basePrisma, tenant.id);
  await basePrisma.$transaction([
    basePrisma.tenant.update({
      where: { id: tenant.id },
      data: { status: 'ACTIVE', trialEndsAt: null },
    }),
    basePrisma.user.updateMany({
      where: { tenantId: tenant.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    }),
  ]);
  await audit(tenant.id, 'TENANT_ACTIVATED');
}

export async function suspendTenant(slug: string): Promise<void> {
  const tenant = await findTenant(slug);
  await assertTenantIdNotProtected(basePrisma, tenant.id);
  await basePrisma.tenant.update({
    where: { id: tenant.id },
    data: { status: 'SUSPENDED' },
  });
  await audit(tenant.id, 'TENANT_SUSPENDED');
}

export async function deleteTenant(slug: string): Promise<void> {
  const tenant = await findTenant(slug);
  await assertTenantIdNotProtected(basePrisma, tenant.id);
  await basePrisma.tenant.delete({ where: { id: tenant.id } });
}

const IMAGE_FIELDS = ['logo', 'logoDark', 'hero', 'heroSecondary', 'doctorPhoto'] as const;
type ImageField = (typeof IMAGE_FIELDS)[number];
const CONTENT_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

async function storeImage(file: File, field: ImageField, tenantId: string): Promise<string> {
  const ext = CONTENT_TYPES[file.type];
  if (!ext) throw new SuperadminError(`Invalid image type for ${field}`);
  if (file.size > 2 * 1024 * 1024) throw new SuperadminError(`Image too large for ${field}`);
  const key = `${tenantId}/brand-${field}-${randomUUID()}.${ext}`;
  await storage.put(key, Buffer.from(await file.arrayBuffer()));
  return key;
}

export async function saveBrand(
  slug: string,
  raw: Record<string, unknown>,
  uploads: Partial<Record<ImageField, File>>,
): Promise<void> {
  const tenant = await findTenant(slug);
  const values = brandingFormSchema.parse(raw) as BrandingFormValues;
  const before = await basePrisma.tenantBrand.findUnique({ where: { tenantId: tenant.id } });
  const keys: Record<ImageField, string | null> = {
    logo: before?.logoKey ?? null,
    logoDark: before?.logoDarkKey ?? null,
    hero: before?.heroKey ?? null,
    heroSecondary: before?.heroSecondaryKey ?? null,
    doctorPhoto: before?.doctorPhotoKey ?? null,
  };
  const nextKeys: Record<ImageField, string | null> = { ...keys };
  for (const field of IMAGE_FIELDS) {
    const file = uploads[field];
    if (file) nextKeys[field] = await storeImage(file, field, tenant.id);
  }

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
    logoKey: nextKeys.logo,
    logoDarkKey: nextKeys.logoDark,
    heroKey: nextKeys.hero,
    heroSecondaryKey: nextKeys.heroSecondary,
    doctorName: values.doctorName,
    doctorTitle: values.doctorTitle,
    doctorBio: values.doctorBio,
    doctorPhotoKey: nextKeys.doctorPhoto,
    trialBanner: values.trialBanner,
    trialBannerText: values.trialBannerText,
  };
  await basePrisma.tenantBrand.upsert({
    where: { tenantId: tenant.id },
    update: data,
    create: { tenantId: tenant.id, ...data },
  });
  for (const field of IMAGE_FIELDS) {
    if (nextKeys[field] && keys[field] && nextKeys[field] !== keys[field]) {
      await storage.remove(keys[field] as string).catch(() => undefined);
    }
  }
  await audit(tenant.id, 'BRAND_UPDATED');
}

export async function saveContent(
  slug: string,
  next: Record<string, { en: string; am: string }>,
): Promise<void> {
  const tenant = await findTenant(slug);
  await basePrisma.$transaction(
    Object.entries(next).map(([key, value]) =>
      basePrisma.siteContent.upsert({
        where: { tenantId_key: { tenantId: tenant.id, key } },
        update: { valueEn: value.en, valueAm: value.am },
        create: { tenantId: tenant.id, key, valueEn: value.en, valueAm: value.am },
      }),
    ),
  );
  await audit(tenant.id, 'SITE_CONTENT_UPDATED');
}

export async function saveSettings(slug: string, values: SettingsFormValues): Promise<void> {
  const tenant = await findTenant(slug);
  const map = toSettingValues(values);
  await basePrisma.$transaction(
    SETTING_KEYS.map((key) =>
      basePrisma.setting.upsert({
        where: { tenantId_key: { tenantId: tenant.id, key } },
        update: { value: map[key] as Prisma.InputJsonValue },
        create: { tenantId: tenant.id, key, value: map[key] as Prisma.InputJsonValue },
      }),
    ),
  );
  await audit(tenant.id, 'SETTING_UPDATED');
}

export { IMAGE_FIELDS, WEEKDAYS };
