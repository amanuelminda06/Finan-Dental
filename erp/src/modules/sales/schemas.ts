import { z } from 'zod';
import { isMoneyInRange } from '@/lib/money';
import {
  MAX_CUSTOM_LINE_NAME,
  MAX_QTY,
  MAX_REASON,
  MAX_SALE_LINES,
  PAYMENT_METHODS,
} from './constants';

/** Prices are NUMERIC(12,2): up to 10 integer digits and at most 2 decimals. */
const PRICE_RE = /^\d{1,10}(\.\d{1,2})?$/;

export const saleLineSchema = z
  .object({
    serviceId: z.string().min(1, 'required').max(64, 'tooLong').optional(),
    customName: z
      .string()
      .trim()
      .min(1, 'required')
      .max(MAX_CUSTOM_LINE_NAME, 'tooLong')
      .optional(),
    qty: z.number().int('invalidQuantity').min(1, 'minQuantity').max(MAX_QTY, 'tooMany'),
    /** Explicit per-line price. Blank normalizes to 0.00; server validates it. */
    unitPrice: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || '0.00')
      .refine((value) => PRICE_RE.test(value) && isMoneyInRange(value), 'invalidPrice'),
  })
  .refine((line) => !!line.serviceId !== !!line.customName, 'invalidLine');

export const saleFormSchema = z.object({
  patientId: z.string().max(64, 'tooLong'),
  doctorId: z.string().max(64, 'tooLong'),
  paymentMethod: z.enum(PAYMENT_METHODS, 'invalidPaymentMethod'),
  lines: z.array(saleLineSchema).min(1, 'noLines').max(MAX_SALE_LINES, 'tooManyLines'),
  /** Walk-in marker — no patient record is attached. */
  walkIn: z.boolean(),
});

export type SaleLineInput = z.infer<typeof saleLineSchema>;

export const voidReasonSchema = z.object({
  reason: z.string().trim().min(3, 'required').max(MAX_REASON, 'tooLong'),
});

export type VoidReasonValues = z.infer<typeof voidReasonSchema>;

export const saleFilterSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate')
    .optional(),
  patient: z.string().trim().max(100, 'tooLong').optional(),
  serviceId: z.string().max(64, 'tooLong').optional(),
  doctorId: z.string().max(64, 'tooLong').optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'VOIDED'], 'invalid').optional(),
  paymentMethod: z.enum(PAYMENT_METHODS, 'invalid').optional(),
});

export type SaleFilterValues = z.infer<typeof saleFilterSchema>;
