/**
 * Neutral defaults for a newly provisioned clinic. These are deliberately
 * brand-free: the seeded demo tenant may copy its old values from `public/`,
 * but a clinic created by `tenant:create` must not inherit another clinic's
 * identity, colours or images.
 */

export const BRAND_ASSET_PREFIX = '/api/public/assets/';

export type TenantBrandColors = {
  primary: string;
  secondary: string;
  accent: string;
};

export type TenantBrandSocials = {
  instagram: string;
  telegram: string;
  tiktok: string;
  website: string;
};

export type TenantBrandData = {
  clinicName: string;
  shortName: string;
  tagline: string;
  address: string;
  phones: string[];
  email: string;
  socials: TenantBrandSocials;
  smsSenderName: string;
  currency: string;
  timezone: string;
  locales: string[];
  colors: TenantBrandColors;
  logoKey: string | null;
  logoUrl: string | null;
  logoDarkKey: string | null;
  logoDarkUrl: string | null;
  heroKey: string | null;
  heroUrl: string | null;
  heroSecondaryKey: string | null;
  heroSecondaryUrl: string | null;
  doctorName: string;
  doctorTitle: string;
  doctorBio: string;
  doctorPhotoKey: string | null;
  doctorPhotoUrl: string | null;
  trialBanner: boolean;
  trialBannerText: string;
};

export const NEUTRAL_COLORS: TenantBrandColors = {
  primary: '#0F766E',
  secondary: '#0EA5E9',
  accent: '#FFFFFF',
};

export const EMPTY_SOCIALS: TenantBrandSocials = {
  instagram: '',
  telegram: '',
  tiktok: '',
  website: '',
};

/** Turns a tenant-owned storage key into its public, tenant-scoped asset URL. */
export function brandAssetUrl(key: string | null | undefined): string | null {
  return key ? `${BRAND_ASSET_PREFIX}${key}` : null;
}

export function neutralTenantBrand(input: {
  clinicName: string;
  shortName?: string;
  smsSenderName?: string;
  timezone?: string;
}): TenantBrandData {
  const clinicName = input.clinicName.trim() || 'Clinic';
  return {
    clinicName,
    shortName: input.shortName?.trim() || clinicName.slice(0, 24),
    tagline: '',
    address: '',
    phones: [],
    email: '',
    socials: { ...EMPTY_SOCIALS },
    smsSenderName: (input.smsSenderName?.trim() || 'Clinic').slice(0, 11),
    currency: 'ETB',
    timezone: input.timezone?.trim() || 'Africa/Addis_Ababa',
    locales: ['en', 'am'],
    colors: { ...NEUTRAL_COLORS },
    logoKey: null,
    logoUrl: null,
    logoDarkKey: null,
    logoDarkUrl: null,
    heroKey: null,
    heroUrl: null,
    heroSecondaryKey: null,
    heroSecondaryUrl: null,
    doctorName: '',
    doctorTitle: '',
    doctorBio: '',
    doctorPhotoKey: null,
    doctorPhotoUrl: null,
    trialBanner: true,
    trialBannerText: 'Trial / Demo data',
  };
}

/** CSS custom properties consumed by `globals.css`. */
export function brandCssVars(brand: TenantBrandData): Record<string, string> {
  const contrast = (hex: string) => {
    const value = /^#([0-9a-f]{6})$/i.exec(hex)?.[1];
    if (!value) return '#FFFFFF';
    const [r, g, b] = [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16) / 255);
    const linear = [r, g, b].map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    return luminance > 0.4 ? '#0F172A' : '#FFFFFF';
  };
  return {
    '--finan-brand-primary': brand.colors.primary,
    '--finan-brand-secondary': brand.colors.secondary,
    '--finan-brand-accent': brand.colors.accent,
    '--finan-brand-primary-contrast': contrast(brand.colors.primary),
    '--finan-brand-secondary-contrast': contrast(brand.colors.secondary),
  };
}
