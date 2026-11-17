import { describe, expect, it } from 'vitest';
import {
  isTenantPath,
  tenantApiPath,
  tenantAppPath,
  tenantAssetPath,
  tenantFromPath,
  tenantHref,
  tenantLoginPath,
  tenantPath,
} from './tenant-path';

describe('tenantPath', () => {
  it('prefixes every public path with the tenant slug', () => {
    expect(tenantPath('finan')).toBe('/finan');
    expect(tenantPath('finan', '/')).toBe('/finan');
    expect(tenantPath('finan', '/about')).toBe('/finan/about');
    expect(tenantPath('finan', 'about')).toBe('/finan/about');
    expect(tenantPath('finan', '/doctors/123')).toBe('/finan/doctors/123');
  });

  it('preserves query strings and hashes without duplicating slashes', () => {
    expect(tenantPath('finan', '/patients/?q=Almaz#row')).toBe('/finan/patients?q=Almaz#row');
    expect(tenantPath('finan', '//book//')).toBe('/finan/book');
  });

  it('accepts an object with a slug', () => {
    expect(tenantPath({ slug: 'smile-clinic' }, '/services')).toBe('/smile-clinic/services');
  });

  it('builds sibling ERP and API trees under the tenant', () => {
    expect(tenantAppPath('finan')).toBe('/finan/app');
    expect(tenantAppPath('finan', '/patients/7')).toBe('/finan/app/patients/7');
    expect(tenantApiPath('finan', '/search')).toBe('/finan/api/search');
    expect(tenantAssetPath('finan', '/hero.jpg')).toBe('/finan/static/hero.jpg');
    expect(tenantLoginPath('finan', 's3cret')).toBe('/finan/login/s3cret');
  });

  it('rejects slugs that would break the path scheme', () => {
    expect(() => tenantPath('/finan')).toThrow(/Invalid tenant slug/);
  });
});

describe('tenantHref', () => {
  it('prefixes app-area paths with the ERP tree', () => {
    expect(tenantHref('/patients', 'finan', 'app')).toBe('/finan/app/patients');
    expect(tenantHref('/dashboard/daily?day=2026-11-17', 'finan', 'app')).toBe(
      '/finan/app/dashboard/daily?day=2026-11-17',
    );
  });

  it('prefixes public-area paths with the site tree', () => {
    expect(tenantHref('/about', 'finan', 'public')).toBe('/finan/about');
  });

  it('routes API, asset and home paths from either area', () => {
    expect(tenantHref('/api/patients/export', 'finan', 'app')).toBe(
      '/finan/api/patients/export',
    );
    expect(tenantHref('/api/public/doctors', 'finan', 'public')).toBe(
      '/finan/api/public/doctors',
    );
    expect(tenantHref('/static/hero.jpg', 'finan', 'public')).toBe('/finan/static/hero.jpg');
    expect(tenantHref('/', 'finan', 'app')).toBe('/finan');
  });

  it('passes through non-path and already-prefixed values', () => {
    for (const href of ['tel:+251911', 'sms:+251911', 'https://example.com', '#main', '']) {
      expect(tenantHref(href, 'finan', 'app')).toBe(href);
    }
    expect(tenantHref('/finan/app/patients', 'finan', 'app')).toBe('/finan/app/patients');
    expect(tenantHref('/finan/api/search', 'finan', 'public')).toBe('/finan/api/search');
  });
});

describe('tenantFromPath', () => {
  it('reads a valid slug from the first segment', () => {
    expect(tenantFromPath('/finan')).toBe('finan');
    expect(tenantFromPath('/smile-clinic/app/patients')).toBe('smile-clinic');
  });

  it('returns null for root, reserved and invalid segments', () => {
    for (const path of ['/', '', '/login/x', '/api/search', '/_next/static/x', '/FINAN']) {
      expect(tenantFromPath(path)).toBeNull();
    }
  });

  it('checks whether a path belongs to a tenant', () => {
    expect(isTenantPath('/finan/about', 'finan')).toBe(true);
    expect(isTenantPath('/finan', 'finan')).toBe(true);
    expect(isTenantPath('/finan-dental/about', 'finan')).toBe(false);
    expect(isTenantPath('/smile/about', 'finan')).toBe(false);
  });
});
