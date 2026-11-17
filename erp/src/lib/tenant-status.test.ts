import { describe, expect, it } from 'vitest';
import { cronTenantWhere, isTenantServing } from './tenant-status';

const now = new Date('2026-11-17T12:00:00Z');

describe('isTenantServing', () => {
  it('serves ACTIVE tenants regardless of an old trial date', () => {
    expect(isTenantServing({ status: 'ACTIVE', trialEndsAt: new Date('2020-01-01') }, now)).toBe(
      true,
    );
  });

  it('serves TRIAL tenants until the trial ends', () => {
    expect(isTenantServing({ status: 'TRIAL', trialEndsAt: null }, now)).toBe(true);
    expect(isTenantServing({ status: 'TRIAL', trialEndsAt: new Date('2026-12-01') }, now)).toBe(
      true,
    );
  });

  it('rejects suspended and expired trial tenants', () => {
    expect(isTenantServing({ status: 'SUSPENDED', trialEndsAt: null }, now)).toBe(false);
    expect(isTenantServing({ status: 'TRIAL', trialEndsAt: new Date('2026-11-01') }, now)).toBe(
      false,
    );
    expect(isTenantServing({ status: 'TRIAL', trialEndsAt: now }, now)).toBe(false);
  });
});

describe('cronTenantWhere', () => {
  it('selects TRIAL and ACTIVE tenants but skips expired trials', () => {
    const where = cronTenantWhere(now);
    expect(where.OR).toHaveLength(3);
    expect(where.OR).toContainEqual({ status: 'ACTIVE' });
    expect(where.OR).toContainEqual({ status: 'TRIAL', trialEndsAt: null });
    expect(where.OR).toContainEqual({ status: 'TRIAL', trialEndsAt: { gt: now } });
  });
});
