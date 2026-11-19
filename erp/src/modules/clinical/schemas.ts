import { z } from 'zod';
import { isMoneyInRange } from '@/lib/money';
import { PAYMENT_METHODS } from '@/modules/sales/constants';
import {
  MAX_NOTE_CHARS,
  MAX_SEARCH_QUERY,
  MAX_SURFACE_NOTE_CHARS,
  MAX_SURFACES,
  MAX_TEXT_ITEM_CHARS,
  MAX_TEXT_ITEMS,
  PLAN_STATUSES,
  isValidToothNumber,
} from './constants';

const PRICE_RE = /^\d{1,10}(\.\d{1,2})?$/;

function jsonArray(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function jsonObject(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const textItemsSchema = z.preprocess(
  jsonArray,
  z.array(z.string().trim().max(MAX_TEXT_ITEM_CHARS, 'tooLong')).max(MAX_TEXT_ITEMS, 'tooMany'),
);

const surfaceNotesSchema = z.preprocess(
  jsonObject,
  z
    .record(
      z.string().trim().min(1).max(40),
      z.string().trim().max(MAX_SURFACE_NOTE_CHARS, 'tooLong'),
    )
    .refine((value) => Object.keys(value).length <= MAX_SURFACES, 'tooMany'),
);

const priceSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null)
  .refine(
    (value) => value === null || (PRICE_RE.test(value) && isMoneyInRange(value)),
    'invalidPrice',
  );

const toothSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number(value) : null))
  .refine((value) => value === null || isValidToothNumber(value), 'invalidTooth');

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate');

export const clinicalProfileSchema = z.object({
  patientId: z.string().min(1, 'required').max(64),
  conditions: textItemsSchema,
  allergies: textItemsSchema,
  medications: textItemsSchema,
  habits: textItemsSchema,
  history: textItemsSchema,
  historyNotes: z.string().trim().max(MAX_NOTE_CHARS, 'tooLong'),
});

export type ClinicalProfileValues = z.infer<typeof clinicalProfileSchema>;

export const clinicalToothSchema = z.object({
  patientId: z.string().min(1, 'required').max(64),
  toothNumber: z.coerce.number().int().refine(isValidToothNumber, 'invalidTooth'),
  finding: z.string().trim().max(MAX_TEXT_ITEM_CHARS, 'tooLong'),
  note: z.string().trim().max(MAX_NOTE_CHARS, 'tooLong'),
  surfaces: surfaceNotesSchema,
});

export type ClinicalToothValues = z.infer<typeof clinicalToothSchema>;

export const clinicalVisitSchema = z.object({
  patientId: z.string().min(1, 'required').max(64),
  visitDate: dateSchema,
  body: z.string().trim().max(MAX_NOTE_CHARS, 'tooLong'),
  subjective: z.string().trim().max(MAX_NOTE_CHARS, 'tooLong'),
  objective: z.string().trim().max(MAX_NOTE_CHARS, 'tooLong'),
  assessment: z.string().trim().max(MAX_NOTE_CHARS, 'tooLong'),
  plan: z.string().trim().max(MAX_NOTE_CHARS, 'tooLong'),
  diagnosis: z.string().trim().max(MAX_TEXT_ITEM_CHARS, 'tooLong'),
  materials: z.string().trim().max(MAX_TEXT_ITEM_CHARS, 'tooLong'),
  anesthesia: z.string().trim().max(MAX_TEXT_ITEM_CHARS, 'tooLong'),
});

export type ClinicalVisitValues = z.infer<typeof clinicalVisitSchema>;

export const clinicalPlanItemSchema = z.object({
  patientId: z.string().min(1, 'required').max(64),
  serviceId: z.string().trim().max(64),
  procedureName: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  manualPrice: priceSchema,
  toothNumber: toothSchema,
  status: z.enum(PLAN_STATUSES, 'invalid'),
  notes: z.string().trim().max(MAX_NOTE_CHARS, 'tooLong'),
});

export type ClinicalPlanItemValues = z.infer<typeof clinicalPlanItemSchema>;

export const clinicalPlanStatusSchema = z.object({
  patientId: z.string().min(1, 'required').max(64),
  id: z.string().min(1, 'required').max(64),
  status: z.enum(PLAN_STATUSES, 'invalid'),
});

export const convertPlanItemSchema = z.object({
  patientId: z.string().min(1, 'required').max(64),
  id: z.string().min(1, 'required').max(64),
  paymentMethod: z.enum(PAYMENT_METHODS, 'invalidPaymentMethod'),
});

export const clinicalSearchSchema = z.object({
  patientId: z.string().min(1, 'required').max(64),
  query: z.string().trim().min(1, 'required').max(MAX_SEARCH_QUERY, 'tooLong'),
});
