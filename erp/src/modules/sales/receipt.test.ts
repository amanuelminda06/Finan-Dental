import { describe, expect, it } from 'vitest';
import { formatReceiptNumber, receiptYear, clampReceiptClaim, RECEIPT_PAD } from './receipt';

const TZ = 'Africa/Addis_Ababa';

describe('clampReceiptClaim', () => {
  it('passes the claim through when the counter is ahead of the data', () => {
    expect(clampReceiptClaim(7, 3)).toBe(7);
    expect(clampReceiptClaim(4, 1)).toBe(4);
  });

  it('heals a counter that drifted behind existing receipts', () => {
    expect(clampReceiptClaim(1, 1)).toBe(2);
    expect(clampReceiptClaim(1, 42)).toBe(43);
    // Counter row missing / zeroed → claim starts at 1, receipts already exist.
    expect(clampReceiptClaim(0, 1)).toBe(2);
    expect(clampReceiptClaim(NaN, 5)).toBe(6);
  });

  it('keeps the first receipt of a fresh year at 1', () => {
    expect(clampReceiptClaim(1, 0)).toBe(1);
    expect(clampReceiptClaim(1, -3)).toBe(1);
  });
});

describe('formatReceiptNumber', () => {
  it('pads to 6 digits', () => {
    expect(RECEIPT_PAD).toBe(6);
    expect(formatReceiptNumber(2026, 1)).toBe('2026-000001');
    expect(formatReceiptNumber(2026, 123)).toBe('2026-000123');
    expect(formatReceiptNumber(2026, 999999)).toBe('2026-999999');
  });

  it('rejects invalid values', () => {
    expect(() => formatReceiptNumber(2026, 0)).toThrow();
    expect(() => formatReceiptNumber(2026.5, 1)).toThrow();
    expect(() => formatReceiptNumber(2026, 1.5)).toThrow();
  });
});

describe('receiptYear', () => {
  it('uses the clinic timezone (23:30 Addis is still the same year)', () => {
    expect(receiptYear(new Date('2026-12-31T20:30:00.000Z'), TZ)).toBe(2026);
    expect(receiptYear(new Date('2026-12-31T21:30:00.000Z'), TZ)).toBe(2027);
  });
});
