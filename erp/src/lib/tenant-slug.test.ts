import { describe, expect, it } from 'vitest';
import {
  TENANT_SLUG_MAX,
  TENANT_SLUG_MIN,
  isValidTenantSlug,
  parseTenantSlug,
  RESERVED_SLUGS,
  isReservedSlug,
} from './tenant-slug';

describe('parseTenantSlug', () => {
  it('accepts lowercase letters, digits and inner hyphens', () => {
    for (const slug of ['finan', 'finan-dental', 'clinic2', 'a-b-c']) {
      expect(parseTenantSlug(slug)).toEqual({ ok: true, slug });
    }
  });

  it('trims surrounding whitespace before validating', () => {
    expect(parseTenantSlug('  finan  ')).toEqual({ ok: true, slug: 'finan' });
  });

  it('requires a value', () => {
    expect(parseTenantSlug('')).toEqual({ ok: false, error: 'required' });
    expect(parseTenantSlug('   ')).toEqual({ ok: false, error: 'required' });
  });

  it('enforces the length bounds', () => {
    expect(parseTenantSlug('ab')).toEqual({ ok: false, error: 'tooShort' });
    expect(parseTenantSlug('a'.repeat(TENANT_SLUG_MIN))).toMatchObject({ ok: true });
    expect(parseTenantSlug('a'.repeat(TENANT_SLUG_MAX))).toMatchObject({ ok: true });
    expect(parseTenantSlug('a'.repeat(TENANT_SLUG_MAX + 1))).toEqual({
      ok: false,
      error: 'tooLong',
    });
  });

  it('rejects uppercase, underscores, dots and spaces', () => {
    for (const slug of ['Finan', 'finan_dental', 'finan.dental', 'finan dental', 'finan!']) {
      expect(parseTenantSlug(slug)).toEqual({ ok: false, error: 'invalidChars' });
    }
  });

  it('rejects leading and trailing hyphens', () => {
    expect(parseTenantSlug('-finan')).toEqual({ ok: false, error: 'edgeHyphen' });
    expect(parseTenantSlug('finan-')).toEqual({ ok: false, error: 'edgeHyphen' });
  });

  it('rejects reserved slugs', () => {
    for (const slug of ['login', 'api', 'admin', 'dashboard', 'www', 'public']) {
      expect(RESERVED_SLUGS).toContain(slug);
      expect(parseTenantSlug(slug)).toEqual({ ok: false, error: 'reserved' });
    }
  });

  it('keeps _next reserved even though it also fails the character rule', () => {
    expect(RESERVED_SLUGS).toContain('_next');
    expect(parseTenantSlug('_next')).toEqual({ ok: false, error: 'invalidChars' });
  });

  it('does not treat a slug that merely contains a reserved word as reserved', () => {
    expect(parseTenantSlug('login-dental')).toEqual({ ok: true, slug: 'login-dental' });
  });
});

describe('isValidTenantSlug', () => {
  it('is the boolean shorthand', () => {
    expect(isValidTenantSlug('finan')).toBe(true);
    expect(isValidTenantSlug('Finan')).toBe(false);
  });
});

describe('isReservedSlug', () => {
  it('is case-insensitive and trims', () => {
    expect(isReservedSlug(' LOGIN ')).toBe(true);
    expect(isReservedSlug('finan')).toBe(false);
  });
});
