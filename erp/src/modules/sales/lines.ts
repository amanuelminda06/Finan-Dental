import { isMoneyInRange, multiplyMoney, sumLineTotals, toDecimalString } from '@/lib/money';
import { MAX_QTY } from './constants';

/**
 * Sales line computation (pure — unit tested).
 *
 * The client sends service/custom-item details, qty and an OPTIONAL explicit
 * unit price. Prices are normalized here: a valid explicit override is used,
 * otherwise the database service price is used. Names and prices are captured
 * as snapshots, so later catalog changes never touch existing sales.
 */
export type ServiceSnapshot = {
  id: string;
  name: string;
  currentPrice: string | null;
  active: boolean;
};

export type RequestedLine = {
  serviceId: string;
  qty: number;
  unitPrice?: string | null;
};

export type ComputedLine = {
  serviceId: string;
  serviceNameSnapshot: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
  priceOverridden: boolean;
};

export type ComputeError =
  'serviceMissing' | 'serviceInactive' | 'serviceUnpriced' | 'invalidPrice' | 'quantityTooHigh';

export type ComputeSaleLinesResult =
  | { ok: true; lines: ComputedLine[]; total: string }
  | { ok: false; error: ComputeError; serviceNames: string[] };

const PRICE_RE = /^\d{1,10}(\.\d{1,2})?$/;

function normalizedOverride(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  return value.trim();
}

/** Duplicate rows merge only when they carry the same explicit price. */
function mergeRequested(requested: RequestedLine[]): RequestedLine[] {
  const merged = new Map<string, RequestedLine>();
  for (const line of requested) {
    const override = normalizedOverride(line.unitPrice);
    const key = `${line.serviceId}|${override ?? ''}`;
    const existing = merged.get(key);
    if (existing) {
      existing.qty += line.qty;
      continue;
    }
    merged.set(key, {
      serviceId: line.serviceId,
      qty: line.qty,
      unitPrice: override ?? undefined,
    });
  }
  return [...merged.values()];
}

export function computeSaleLines(
  services: ServiceSnapshot[],
  requested: RequestedLine[],
): ComputeSaleLinesResult {
  const byId = new Map(services.map((service) => [service.id, service]));
  const merged = mergeRequested(requested);

  const missing: string[] = [];
  const inactive: string[] = [];
  const unpriced: string[] = [];
  const invalidPrices: string[] = [];
  const lines: ComputedLine[] = [];

  for (const requestedLine of merged) {
    const service = byId.get(requestedLine.serviceId);
    if (!service) {
      missing.push(requestedLine.serviceId);
      continue;
    }
    if (!service.active) {
      inactive.push(service.name);
      continue;
    }
    if (requestedLine.qty < 1 || requestedLine.qty > MAX_QTY) {
      return { ok: false, error: 'quantityTooHigh', serviceNames: [service.name] };
    }

    const override = normalizedOverride(requestedLine.unitPrice);
    if (override !== null && (!PRICE_RE.test(override) || !isMoneyInRange(override))) {
      invalidPrices.push(service.name);
      continue;
    }
    const price = override ?? service.currentPrice;
    if (price === null) {
      unpriced.push(service.name);
      continue;
    }

    lines.push({
      serviceId: service.id,
      serviceNameSnapshot: service.name,
      qty: requestedLine.qty,
      unitPrice: toDecimalString(price),
      lineTotal: toDecimalString(multiplyMoney(price, requestedLine.qty)),
      priceOverridden: override !== null,
    });
  }

  if (invalidPrices.length > 0) {
    return { ok: false, error: 'invalidPrice', serviceNames: invalidPrices };
  }
  if (inactive.length > 0) return { ok: false, error: 'serviceInactive', serviceNames: inactive };
  if (unpriced.length > 0) return { ok: false, error: 'serviceUnpriced', serviceNames: unpriced };
  if (missing.length > 0) return { ok: false, error: 'serviceMissing', serviceNames: missing };
  if (lines.length === 0) return { ok: false, error: 'serviceMissing', serviceNames: [] };

  const total = sumLineTotals(
    lines.map((line) => ({ unitPrice: line.unitPrice, quantity: line.qty })),
  );

  return { ok: true, lines, total: toDecimalString(total) };
}
