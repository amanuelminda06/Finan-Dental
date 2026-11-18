import type { Prisma, PrismaClient } from '@prisma/client';
import { neutralTenantBrand, type TenantBrandData } from '../src/modules/tenant-brand/defaults';
import type { Bilingual, SiteContentKey } from '../src/modules/public-site/content';
import { seedBrandAssets } from './seed-assets';
import { seedMessageTemplates } from './seed-messages';
import { seedSiteContent } from './seed-content';
import { seedServicesAndSales } from './seed-services';
import { seedPatientRows, TAG_NAMES, tagColorFor } from './seed-patients';

/**
 * The one dental starter template used by both `npm run db:seed` and
 * `npm run tenant:create`. It writes ONLY rows for the tenant it is given;
 * every image is copied into that tenant's storage first.
 */
export type ApplyDentalTemplateOptions = {
  clinicName: string;
  shortName?: string;
  smsSenderName?: string;
  /** Legacy demo values from the old global config; never used for new clinics. */
  legacy?: boolean;
  /** Add invented patients (used by `tenant:create --demo-data`). */
  demoData?: boolean;
  /** Keep the OWNER's saved brand/settings (used by `tenant:reset-demo`). */
  preserveIdentity?: boolean;
};

export type DentalTemplateResult = {
  brand: TenantBrandData;
  settings: number;
  services: number;
  templates: number;
  content: number;
  demoPatients: number;
};

const LEGACY = {
  clinicName: 'Finan Speciality Dental Clinic',
  shortName: 'Finan',
  address: 'Abrams Building, 2nd Floor',
  phones: ['0948023831', '0911055655'],
  email: 'shalomwordi@gmail.com',
  telegram: '@finan8',
  smsSenderName: 'FinanDental',
  doctorName: 'Dr. Abebe Kebede',
  doctorTitle: 'Dentist',
  colors: { primary: '#129CF4', secondary: '#80BD08', accent: '#FFFFFF' },
} as const;

function legacyContent(): Partial<Record<SiteContentKey, Bilingual>> {
  const value = (text: string): Bilingual => ({ en: text, am: text });
  return {
    privacy_body: {
      en: `PLACEHOLDER — This privacy policy has not been finalised. ${LEGACY.clinicName} collects the information you submit through the appointment request form (your name, phone number, preferred date and time) only to contact you about your request. We do not ask for or store medical details on this website. The clinic must replace this text with its reviewed privacy policy before launch.`,
      am: 'ጊዜያዊ — ይህ የግላዊነት ፖሊሲ አልተጠናቀቀም። ፊናን ስፔሻሊቲ የጥርስ ክሊኒክ በቀጠሮ ጥያቄ ቅጽ የሚያስገቡትን መረጃ (ስምዎን፣ ስልክ ቁጥርዎን፣ የሚፈልጉትን ቀንና ሰዓት) ስለ ጥያቄዎ ለማግኘት ብቻ ይሰበስባል። በዚህ ድህረ ገጽ የህክምና ዝርዝር አንጠይቅም አናከማችም። ክሊኒኩ ከመጀመሩ በፊት ይህን ጽሑፍ በተገመገመ የግላዊነት ፖሊሲ መተካት አለበት።',
    },
    contact_address: value(LEGACY.address),
    contact_phone_primary: value(LEGACY.phones[0]),
    contact_phone_backup: value(LEGACY.phones[1]),
    social_tiktok: value('https://tiktok.com/@finandentalclinic'),
    social_instagram: value('https://instagram.com/finandentalclinic'),
    social_telegram: value(`https://t.me/${LEGACY.telegram.slice(1)}`),
    city: { en: 'Addis Ababa', am: 'PLACEHOLDER — city' },
    country: { en: 'Ethiopia', am: 'PLACEHOLDER — country' },
    og_city: { en: 'Addis Ababa, Ethiopia', am: 'PLACEHOLDER — open-graph city' },
  };
}

export function defaultSettings(brand: TenantBrandData): Array<{ key: string; value: Prisma.InputJsonValue }> {
  return [
    { key: 'clinic_name', value: brand.clinicName },
    { key: 'currency', value: brand.currency },
    { key: 'timezone', value: brand.timezone },
    {
      key: 'working_hours',
      value: {
        mon: { open: '08:00', close: '17:00', closed: false },
        tue: { open: '08:00', close: '17:00', closed: false },
        wed: { open: '08:00', close: '17:00', closed: false },
        thu: { open: '08:00', close: '17:00', closed: false },
        fri: { open: '08:00', close: '17:00', closed: false },
        sat: { open: '08:00', close: '12:00', closed: false },
        sun: { open: '08:00', close: '12:00', closed: true },
      },
    },
    { key: 'reminder_send_time', value: '14:00' },
    { key: 'reminder_send_by_offset_minutes', value: 60 },
    { key: 'followup_lead_days', value: 3 },
    { key: 'recall_months', value: 12 },
    { key: 'review_link', value: '' },
    { key: 'sms_mode', value: 'MANUAL_LINK' },
    { key: 'reception_can_send_campaigns', value: false },
    { key: 'campaign_max_recipients', value: 300 },
    { key: 'digest_enabled', value: false },
    { key: 'digest_email', value: '' },
    { key: 'default_language', value: brand.locales[0] ?? 'en' },
    { key: 'group_sms_allow_for_filtered', value: false },
    { key: 'group_sms_max_recipients', value: 15 },
  ];
}

async function seedDemoPatients(prisma: PrismaClient, tenantId: string): Promise<number> {
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: 'OWNER' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const tagIds = new Map<string, string>();
  for (const name of TAG_NAMES) {
    const tag = await prisma.tag.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name, color: tagColorFor(name) },
    });
    tagIds.set(name, tag.id);
  }

  const rows = seedPatientRows();
  for (const row of rows) {
    const phoneE164 = row.phoneE164 ?? row.phone;
    const data = {
      tenantId,
      fullName: row.fullName,
      phoneE164,
      sex: row.sex,
      birthDate: row.birthDateDate,
      preferredLanguage: row.preferredLanguage,
      notesNonClinical: row.notesNonClinical ?? null,
      doNotMessage: row.doNotMessage ?? false,
      doNotMessageReason: row.doNotMessageReason ?? null,
      active: row.active ?? true,
      createdBy: owner?.id ?? 'seed',
    };
    const patient = await prisma.patient.upsert({
      where: { tenantId_phoneE164: { tenantId, phoneE164 } },
      update: data,
      create: data,
    });
    for (const tagName of row.tags) {
      const tagId = tagIds.get(tagName);
      if (!tagId) continue;
      await prisma.patientTag.upsert({
        where: { patientId_tagId: { patientId: patient.id, tagId } },
        update: {},
        create: { tenantId, patientId: patient.id, tagId },
      });
    }
  }

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Patient_tenantId_birthday_md_idx" ON "Patient" ' +
      '("tenantId", (EXTRACT(MONTH FROM "birthDate") * 100 + EXTRACT(DAY FROM "birthDate")))',
  );
  return rows.length;
}

export async function applyDentalTemplate(
  prisma: PrismaClient,
  tenantId: string,
  options: ApplyDentalTemplateOptions,
): Promise<DentalTemplateResult> {
  const legacy = options.legacy ?? false;
  const assets = await seedBrandAssets(tenantId, { legacy });
  const brand = neutralTenantBrand({
    clinicName: options.clinicName,
    shortName: options.shortName,
    smsSenderName: options.smsSenderName,
  });

  if (legacy) {
    Object.assign(brand, {
      clinicName: LEGACY.clinicName,
      shortName: LEGACY.shortName,
      address: LEGACY.address,
      phones: [...LEGACY.phones],
      email: LEGACY.email,
      socials: { ...brand.socials, telegram: LEGACY.telegram },
      smsSenderName: LEGACY.smsSenderName,
      doctorName: LEGACY.doctorName,
      doctorTitle: LEGACY.doctorTitle,
      colors: { ...LEGACY.colors },
      trialBanner: false,
    });
  }
  brand.logoKey = assets.logoKey;
  brand.heroKey = assets.heroKey;
  brand.heroSecondaryKey = assets.heroSecondaryKey;
  brand.doctorPhotoKey = legacy ? assets.doctorPhotoKey : null;

  const settings = defaultSettings(brand);
  if (!options.preserveIdentity) {
    const data = {
      clinicName: brand.clinicName,
      shortName: brand.shortName,
      tagline: brand.tagline,
      address: brand.address,
      phones: brand.phones as Prisma.InputJsonValue,
      email: brand.email,
      socials: brand.socials as Prisma.InputJsonValue,
      smsSenderName: brand.smsSenderName,
      currency: brand.currency,
      timezone: brand.timezone,
      locales: brand.locales as Prisma.InputJsonValue,
      colors: brand.colors as Prisma.InputJsonValue,
      logoKey: brand.logoKey,
      logoDarkKey: brand.logoDarkKey,
      heroKey: brand.heroKey,
      heroSecondaryKey: brand.heroSecondaryKey,
      doctorName: brand.doctorName,
      doctorTitle: brand.doctorTitle,
      doctorBio: brand.doctorBio,
      doctorPhotoKey: brand.doctorPhotoKey,
      trialBanner: brand.trialBanner,
      trialBannerText: brand.trialBannerText,
    };
    await prisma.tenantBrand.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data },
    });
    for (const setting of settings) {
      await prisma.setting.upsert({
        where: { tenantId_key: { tenantId, key: setting.key } },
        update: {},
        create: { tenantId, key: setting.key, value: setting.value },
      });
    }
  }

  await seedServicesAndSales(prisma, tenantId, assets.serviceImageUrls);
  const templates = await seedMessageTemplates(prisma, tenantId);
  const content = await seedSiteContent(
    prisma,
    tenantId,
    legacy ? legacyContent() : {},
  );

  if (legacy || brand.doctorName) {
    const existing = await prisma.staff.findFirst({
      where: { tenantId, fullName: brand.doctorName, isDoctor: true },
      select: { id: true, photoUrl: true },
    });
    const photoUrl = brand.doctorPhotoKey ? `/api/uploads/${brand.doctorPhotoKey}` : null;
    if (existing) {
      await prisma.staff.update({
        where: { id: existing.id },
        data: {
          jobTitle: brand.doctorTitle || 'Dentist',
          photoUrl: existing.photoUrl?.startsWith('/api/uploads/') ? existing.photoUrl : photoUrl,
          showOnWebsite: true,
          active: true,
        },
      });
    } else {
      await prisma.staff.create({
        data: {
          tenantId,
          fullName: brand.doctorName,
          jobTitle: brand.doctorTitle || 'Dentist',
          isDoctor: true,
          showOnWebsite: true,
          photoUrl,
        },
      });
    }
  }

  const demoPatients = options.demoData ? await seedDemoPatients(prisma, tenantId) : 0;
  return {
    brand,
    settings: settings.length,
    services: assets.serviceImageUrls ? Object.keys(assets.serviceImageUrls).length : 0,
    templates,
    content: content.keys,
    demoPatients,
  };
}
