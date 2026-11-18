import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  decodeSuperadminToken,
  encodeSuperadminToken,
  verifySuperadminCredentials,
} from './superadmin-auth';
import { SUPERADMIN_USERNAME } from './superadmin-constants';

const SECRET = 'test-secret-at-least-16-characters';
const originalSecret = process.env.AUTH_SECRET;

describe('superadmin platform session', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
  });

  it('accepts only the fixed platform credentials', () => {
    expect(verifySuperadminCredentials('Aman', '2906')).toBe(true);
    expect(verifySuperadminCredentials(' Aman ', '2906')).toBe(true);
    expect(verifySuperadminCredentials('aman', '2906')).toBe(false);
    expect(verifySuperadminCredentials('Aman', '2907')).toBe(false);
    expect(verifySuperadminCredentials(undefined, undefined)).toBe(false);
  });

  it('round-trips a valid signed token without carrying a tenant id', () => {
    const token = encodeSuperadminToken(SUPERADMIN_USERNAME, Date.now() + 60_000);
    expect(decodeSuperadminToken(token)).toEqual({ username: SUPERADMIN_USERNAME });
    expect(token).not.toContain('tenant');
  });

  it('rejects expired, tampered and unknown-user tokens', () => {
    const expired = encodeSuperadminToken(SUPERADMIN_USERNAME, Date.now() - 1);
    const token = encodeSuperadminToken(SUPERADMIN_USERNAME, Date.now() + 60_000);
    expect(decodeSuperadminToken(expired)).toBeNull();
    expect(decodeSuperadminToken(`${token}tampered`)).toBeNull();
    expect(decodeSuperadminToken('not.a.token')).toBeNull();
    expect(decodeSuperadminToken(undefined)).toBeNull();
    expect(
      decodeSuperadminToken(encodeSuperadminToken('Intruder', Date.now() + 60_000)),
    ).toBeNull();
  });
});
