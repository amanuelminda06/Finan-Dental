import { ok, fail, type ActionResult } from '@/lib/action';
import { writeAudit } from '@/lib/audit';
import { formatMoney, toDecimalString } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import type { SessionUser } from '@/lib/require-role';
import { getTenantId } from '@/lib/tenant-context';
import { validate } from '@/lib/errors';
import { getSettingsMap, timezoneFrom } from '@/modules/settings';
import { computeSaleLines, type ServiceSnapshot } from './lines';
import { nextReceiptNumber } from './receipt';
import { saleFormSchema } from './schemas';

/**
 * The sale-writing core, shared by the normal sales form and the doctor-only
 * clinical chart (which converts plan items into receipts). Callers have
 * already authorized their actor with their own role rules.
 */
export type CreateSaleInput = {
  patientId: string;
  doctorId: string;
  paymentMethod: string;
  walkIn: boolean;
  lines: Array<{ serviceId: string; qty: number }>;
};

function isReceiptNumberClash(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate.code !== 'P2002') return false;
  const target = candidate.meta?.target;
  if (Array.isArray(target)) return target.includes('receiptNumber');
  return target === 'receiptNumber';
}

async function withReceiptRetry<T>(write: () => Promise<T>): Promise<T | null> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await write();
    } catch (error) {
      if (!isReceiptNumberClash(error)) throw error;
      if (attempt === MAX_ATTEMPTS) return null;
    }
  }
  return null;
}

export async function createSaleForActor(
  actor: SessionUser,
  input: CreateSaleInput,
): Promise<ActionResult<{ id: string; receiptNumber: string }>> {
  const values = validate(saleFormSchema, input);

  let patientId: string | null = null;
  if (!values.walkIn) {
    if (!values.patientId) return fail('validationError', { patientId: 'required' });
    const patient = await prisma.patient.findUnique({
      where: { id: values.patientId },
      select: { id: true, active: true },
    });
    if (!patient || !patient.active) return fail('validationError', { patientId: 'invalid' });
    patientId = patient.id;
  }

  let doctorId: string | null = null;
  if (values.doctorId) {
    const doctor = await prisma.staff.findUnique({
      where: { id: values.doctorId },
      select: { id: true, active: true },
    });
    if (!doctor || !doctor.active) return fail('validationError', { doctorId: 'invalid' });
    doctorId = doctor.id;
  }

  const serviceIds = [...new Set(values.lines.map((line) => line.serviceId))];
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true, currentPrice: true, active: true },
  });
  const snapshots: ServiceSnapshot[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    currentPrice: service.currentPrice ? toDecimalString(service.currentPrice) : null,
    active: service.active,
  }));

  const computed = computeSaleLines(snapshots, values.lines);
  if (!computed.ok) return fail('validationError', { lines: computed.error });

  const settings = await getSettingsMap();
  const tz = timezoneFrom(settings);
  const now = new Date();
  const tenantId = await getTenantId();

  const sale = await withReceiptRetry(() =>
    prisma.$transaction(async (tx) => {
      const receiptNumber = await nextReceiptNumber(tx, now, tz, tenantId);
      return tx.sale.create({
        data: {
          tenantId,
          receiptNumber,
          patientId,
          doctorId,
          saleDate: now,
          status: 'CONFIRMED',
          paymentMethod: values.paymentMethod,
          total: computed.total,
          createdBy: actor.id,
          confirmedAt: now,
          lines: {
            create: computed.lines.map((line) => ({
              tenantId,
              serviceId: line.serviceId,
              serviceNameSnapshot: line.serviceNameSnapshot,
              qty: line.qty,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            })),
          },
        },
      });
    }),
  );
  if (!sale) return fail('unknownError');

  await writeAudit({
    user: actor,
    entity: 'Sale',
    entityId: sale.id,
    action: 'SALE_CREATED',
    new: {
      receiptNumber: sale.receiptNumber,
      patientId,
      doctorId,
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      total: toDecimalString(sale.total),
      lines: computed.lines.map((line) => ({
        service: line.serviceNameSnapshot,
        qty: line.qty,
        unitPrice: formatMoney(line.unitPrice),
        lineTotal: formatMoney(line.lineTotal),
      })),
    },
  });

  return ok({ id: sale.id, receiptNumber: sale.receiptNumber });
}
