import type { Role } from '@prisma/client';

/** The doctor-only chart never widens the existing patient-admin roles. */
export const CLINICAL_ROLES: Role[] = ['STAFF'];

/** Suggestion categories. Every value is optional text — these are hints only. */
export const SUGGESTION_CATEGORIES = [
  'condition',
  'allergy',
  'medication',
  'habit',
  'history',
  'toothFinding',
  'material',
  'anesthesia',
  'procedure',
  'diagnosis',
] as const;

export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export function isSuggestionCategory(value: unknown): value is SuggestionCategory {
  return typeof value === 'string' && (SUGGESTION_CATEGORIES as readonly string[]).includes(value);
}

/** Free-text item groups in the medical-history card. */
export const TEXT_KINDS = ['condition', 'allergy', 'medication', 'habit', 'history'] as const;
export type TextKind = (typeof TEXT_KINDS)[number];

export function isTextKind(value: unknown): value is TextKind {
  return typeof value === 'string' && (TEXT_KINDS as readonly string[]).includes(value);
}

/** Suggested colours. Typed "custom" findings always use CUSTOM_COLOR. */
export const CUSTOM_COLOR = '#64748b';

export const SUGGESTION_COLORS: Record<SuggestionCategory, string> = {
  condition: '#D97706',
  allergy: '#DC2626',
  medication: '#2563EB',
  habit: '#7C3AED',
  history: '#0D9488',
  toothFinding: '#0284C7',
  material: '#4F46E5',
  anesthesia: '#0891B2',
  procedure: '#059669',
  diagnosis: '#BE185D',
};

/** Permanent FDI tooth numbers used by the odontogram and note links. */
export const TOOTH_NUMBERS: readonly number[] = [
  ...range(11, 18),
  ...range(21, 28),
  ...range(31, 38),
  ...range(41, 48),
];

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let value = from; value <= to; value += 1) out.push(value);
  return out;
}

export function isValidToothNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && TOOTH_NUMBERS.includes(value);
}

/** Standard surface buttons; the note itself is always free text. */
export const SURFACES = [
  'occlusal',
  'mesial',
  'distal',
  'buccal',
  'lingual',
] as const;

export const PLAN_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_STATUS_LABEL_KEYS: Record<PlanStatus, string> = {
  PLANNED: 'statusPlanned',
  IN_PROGRESS: 'statusInProgress',
  COMPLETED: 'statusCompleted',
  CANCELLED: 'statusCancelled',
};

export const MAX_TEXT_ITEM_CHARS = 300;
export const MAX_TEXT_ITEMS = 60;
export const MAX_NOTE_CHARS = 4000;
export const MAX_SURFACE_NOTE_CHARS = 1000;
export const MAX_SURFACES = 20;
export const MAX_SEARCH_QUERY = 200;
export const MAX_PRICE_CHARS = 12;

/**
 * Clinic-owned starting suggestions. Doctors may type anything instead; these
 * are seeded per tenant on first chart use and never restrict an input.
 */
export const CLINICAL_SUGGESTION_DEFAULTS: Record<SuggestionCategory, readonly string[]> = {
  condition: [
    'caries',
    'filled',
    'crown',
    'missing',
    'root canal treated',
    'implant',
    'fracture',
    'impaction',
    'discolouration',
    'wear',
  ],
  allergy: [
    'penicillin',
    'amoxicillin',
    'lidocaine',
    'aspirin',
    'ibuprofen',
    'latex',
    'iodine',
  ],
  medication: [
    'amoxicillin',
    'metronidazole',
    'paracetamol',
    'ibuprofen',
    'warfarin',
    'metformin',
    'amlodipine',
  ],
  habit: ['smoking', 'chewing khat', 'alcohol', 'bruxism', 'nail biting', 'betel nut'],
  history: [
    'diabetes',
    'hypertension',
    'heart disease',
    'asthma',
    'epilepsy',
    'pregnancy',
    'blood disorder',
    'previous radiation',
  ],
  toothFinding: [
    'caries',
    'filled',
    'crown',
    'missing',
    'root canal treated',
    'implant',
    'fracture',
    'periapical lesion',
    'impaction',
    'gingivitis',
    'periodontitis',
    'erosion',
    'discolouration',
  ],
  material: [
    'composite',
    'amalgam',
    'glass ionomer',
    'ceramic',
    'zirconia',
    'metal crown',
    'temporary filling',
  ],
  anesthesia: [
    'local infiltration',
    'inferior alveolar block',
    'maxillary block',
    'topical anesthetic',
    'general anesthesia',
  ],
  procedure: [
    'consultation',
    'cleaning',
    'filling',
    'extraction',
    'root canal treatment',
    'crown',
    'implant',
    'scaling',
    'whitening',
  ],
  diagnosis: [
    'dental caries',
    'pulpitis',
    'periapical abscess',
    'periodontitis',
    'gingivitis',
    'impacted tooth',
    'tooth fracture',
    'edentulous space',
  ],
};
