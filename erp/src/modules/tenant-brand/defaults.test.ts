import { describe, expect, it } from 'vitest';
import { brandAssetUrl, brandCssVars, neutralTenantBrand } from './defaults';
import { normalizeTenantBrand } from './queries';

describe('tenant brand defaults', () => {
  it('does not inherit another clinic name or colours', () => {
    const a = neutralTenantBrand({ clinicName: 'Almas Dental' });
    const b = neutralTenantBrand({ clinicName: 'Bright Smiles' });
    expect(a.clinicName).toBe('Almas Dental');
    expect(b.clinicName).toBe('Bright Smiles');
    expect(a.logoUrl).toBeNull();
    expect(a.heroUrl).toBeNull();
    expect(a.colors).toEqual(b.colors);
    expect(brandCssVars(a)['--finan-brand-primary']).toBe(a.colors.primary);
  });

  it('derives readable contrast from the tenant colour', () => {
    const light = neutralTenantBrand({ clinicName: 'Light Clinic' });
    light.colors.primary = '#FFFFFF';
    const dark = neutralTenantBrand({ clinicName: 'Dark Clinic' });
    dark.colors.primary = '#000000';
    expect(brandCssVars(light)['--finan-brand-primary-contrast']).toBe('#0F172A');
    expect(brandCssVars(dark)['--finan-brand-primary-contrast']).toBe('#FFFFFF');
  });

  it('builds storage-backed asset URLs and rejects malformed stored values', () => {
    expect(brandAssetUrl('tenant_a/brand-logo-1.png')).toBe(
      '/api/public/assets/tenant_a/brand-logo-1.png',
    );
    const row = {
      clinicName: 'Bright Smiles',
      shortName: 'Bright',
      tagline: '',
      address: 'B Street',
      phones: ['0911111111', 42],
      email: '',
      socials: { telegram: '@bright', instagram: 7 },
      smsSenderName: 'BrightSmile',
      currency: 'ETB',
      timezone: 'Africa/Addis_Ababa',
      locales: ['en', 'fr'],
      colors: { primary: 'not-a-colour', secondary: '#123456', accent: '#FFFFFF' },
      logoKey: 'tenant_b/brand-logo-2.png',
      logoDarkKey: null,
      heroKey: null,
      heroSecondaryKey: null,
      doctorName: '',
      doctorTitle: '',
      doctorBio: '',
      doctorPhotoKey: null,
      trialBanner: false,
      trialBannerText: '',
    };
    const normalized = normalizeTenantBrand(row);
    expect(normalized.phones).toEqual(['0911111111']);
    expect(normalized.locales).toEqual(['en']);
    expect(normalized.colors.primary).toBe('#0F766E');
    expect(normalized.socials.telegram).toBe('@bright');
    expect(normalized.logoUrl).toBe('/api/public/assets/tenant_b/brand-logo-2.png');
  });
});
