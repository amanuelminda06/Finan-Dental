import { describe, expect, it } from 'vitest';
import { computeSaleLines, type ServiceSnapshot } from './lines';

const consultation: ServiceSnapshot = {
  id: 'svc-1',
  name: 'Free Consultation',
  currentPrice: '0.00',
  active: true,
};
const cleaning: ServiceSnapshot = {
  id: 'svc-2',
  name: 'Modern Teeth Cleaning and Polishing',
  currentPrice: '1500.50',
  active: true,
};

describe('computeSaleLines', () => {
  it('uses the server price snapshot, never a client value', () => {
    const result = computeSaleLines(
      [consultation, cleaning],
      [
        { serviceId: 'svc-1', qty: 2 },
        { serviceId: 'svc-2', qty: 1 },
      ],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0]).toMatchObject({
      serviceNameSnapshot: 'Free Consultation',
      unitPrice: '0.00',
      qty: 2,
      lineTotal: '0.00',
    });
    expect(result.total).toBe('1500.50');
  });

  it('merges duplicate service rows by summing quantities', () => {
    const result = computeSaleLines(
      [consultation],
      [
        { serviceId: 'svc-1', qty: 1 },
        { serviceId: 'svc-1', qty: 2 },
      ],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].qty).toBe(3);
    expect(result.lines[0].lineTotal).toBe('0.00');
  });

  it('keeps the price frozen at sale time (later price changes do not apply)', () => {
    const first = computeSaleLines([consultation], [{ serviceId: 'svc-1', qty: 1 }]);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.lines[0].unitPrice).toBe('0.00');

    const paidService: ServiceSnapshot = { ...cleaning, id: 'svc-1', currentPrice: '400.00' };
    const second = computeSaleLines([paidService], [{ serviceId: 'svc-1', qty: 1 }]);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.lines[0].unitPrice).toBe('400.00');
    expect(first.lines[0].unitPrice).toBe('0.00');
  });

  it('allows the ERP to record a sale only after a price is entered', () => {
    const unpriced: ServiceSnapshot = { ...consultation, currentPrice: null };
    const result = computeSaleLines([unpriced], [{ serviceId: 'svc-1', qty: 1 }]);
    expect(result).toMatchObject({ ok: false, error: 'serviceUnpriced' });
  });

  it('rejects inactive services', () => {
    const inactive: ServiceSnapshot = { ...consultation, active: false };
    const result = computeSaleLines([inactive], [{ serviceId: 'svc-1', qty: 1 }]);
    expect(result).toMatchObject({ ok: false, error: 'serviceInactive' });
  });

  it('rejects services that no longer exist', () => {
    const result = computeSaleLines([consultation], [{ serviceId: 'missing', qty: 1 }]);
    expect(result).toMatchObject({ ok: false, error: 'serviceMissing' });
  });

  it('rejects quantities below 1 or above the cap', () => {
    expect(computeSaleLines([consultation], [{ serviceId: 'svc-1', qty: 0 }])).toMatchObject({
      ok: false,
      error: 'quantityTooHigh',
    });
    expect(computeSaleLines([consultation], [{ serviceId: 'svc-1', qty: 1000 }])).toMatchObject({
      ok: false,
      error: 'quantityTooHigh',
    });
  });
});
