import { describe, expect, it } from 'vitest';
import { saleLineSchema } from './schemas';

describe('saleLineSchema', () => {
  it('normalizes a blank price to 0.00', () => {
    const parsed = saleLineSchema.safeParse({ serviceId: 'svc-1', qty: 1, unitPrice: '' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.unitPrice).toBe('0.00');
  });

  it('requires exactly one of serviceId or customName', () => {
    expect(saleLineSchema.safeParse({ qty: 1 }).success).toBe(false);
    expect(
      saleLineSchema.safeParse({ serviceId: 'svc-1', customName: 'One-off', qty: 1 }).success,
    ).toBe(false);
    expect(saleLineSchema.safeParse({ customName: 'One-off', qty: 1 }).success).toBe(true);
  });

  it('rejects invalid explicit prices', () => {
    expect(saleLineSchema.safeParse({ serviceId: 'svc-1', qty: 1, unitPrice: '-1' }).success).toBe(
      false,
    );
    expect(
      saleLineSchema.safeParse({ serviceId: 'svc-1', qty: 1, unitPrice: '1.234' }).success,
    ).toBe(false);
  });
});
