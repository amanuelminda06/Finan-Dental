import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/tenant-context';
import {
  brandAssetUrl,
  EMPTY_SOCIALS,
  neutralTenantBrand,
  NEUTRAL_COLORS,
  type TenantBrandColors,
  type TenantBrandData,
  type TenantBrandSocials,
} from './defaults';

type BrandRow = {
  clinicName: string;
  shortName: string;
  tagline: string;
  address: string;
  phones: unknown;
  email: string;
  socials: unknown;
  smsSenderName: string;
  currency: string;
  timezone: string;
  locales: unknown;
  colors: unknown;
  logoKey: string | null;
  logoDarkKey: string | null;
  heroKey: string | null;
  heroSecondaryKey: string | null;
  doctorName: string;
  doctorTitle: string;
  doctorBio: string;
  doctorPhotoKey: string | null;
  trialBanner: boolean;
  trialBannerText: string;
};

const HEX = /^#[0-9a-f]{6}$/i;

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function colorsFrom(value: unknown): TenantBrandColors {
  const map = stringMap(value);
  return {
    primary: HEX.test(map.primary ?? '') ? map.primary : NEUTRAL_COLORS.primary,
    secondary: HEX.test(map.secondary ?? '') ? map.secondary : NEUTRAL_COLORS.secondary,
    accent: HEX.test(map.accent ?? '') ? map.accent : NEUTRAL_COLORS.accent,
  };
}

function socialsFrom(value: unknown): TenantBrandSocials {
  const map = stringMap(value);
  return {
    instagram: map.instagram ?? '',
    telegram: map.telegram ?? '',
    tiktok: map.tiktok ?? '',
    website: map.website ?? '',
  };
}

/** Defensive projection: stored JSON is untrusted and may predate a field. */
export function normalizeTenantBrand(row: BrandRow): TenantBrandData {
  return {
    clinicName: row.clinicName || 'Clinic',
    shortName: row.shortName || row.clinicName || 'Clinic',
    tagline: row.tagline ?? '',
    address: row.address ?? '',
    phones: stringList(row.phones),
    email: row.email ?? '',
    socials: socialsFrom(row.socials) ?? { ...EMPTY_SOCIALS },
    smsSenderName: row.smsSenderName || 'Clinic',
    currency: row.currency || 'ETB',
    timezone: row.timezone || 'Africa/Addis_Ababa',
    locales: stringList(row.locales).filter((code) => code === 'en' || code === 'am'),
    colors: colorsFrom(row.colors),
    logoKey: row.logoKey,
    logoUrl: brandAssetUrl(row.logoKey),
    logoDarkKey: row.logoDarkKey,
    logoDarkUrl: brandAssetUrl(row.logoDarkKey),
    heroKey: row.heroKey,
    heroUrl: brandAssetUrl(row.heroKey),
    heroSecondaryKey: row.heroSecondaryKey,
    heroSecondaryUrl: brandAssetUrl(row.heroSecondaryKey),
    doctorName: row.doctorName ?? '',
    doctorTitle: row.doctorTitle ?? '',
    doctorBio: row.doctorBio ?? '',
    doctorPhotoKey: row.doctorPhotoKey,
    doctorPhotoUrl: brandAssetUrl(row.doctorPhotoKey),
    trialBanner: row.trialBanner,
    trialBannerText: row.trialBannerText || 'Trial / Demo data',
  };
}

/**
 * The current clinic's editable identity. Cached per request by React so the
 * layout, page and metadata helpers share one query.
 */
export const getTenantBrand = cache(async (): Promise<TenantBrandData> => {
  const tenantId = await getTenantId();
  const row = await prisma.tenantBrand.findUnique({ where: { tenantId } });
  if (!row) return neutralTenantBrand({ clinicName: 'Clinic' });
  return normalizeTenantBrand(row);
});
