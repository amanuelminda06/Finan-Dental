import { MAX_TEXT_ITEM_CHARS, MAX_TEXT_ITEMS, isValidToothNumber } from './constants';

export function normalizeSuggestionLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Free-text items: trim, drop blanks, de-duplicate case-insensitively, cap. */
export function normalizeTextItems(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = value.trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT_ITEM_CHARS);
    if (!text) continue;
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= MAX_TEXT_ITEMS) break;
  }
  return out;
}

const TOOTH_MENTION_RE = /(?:#\s*|tooth\s+)(\d{1,2})\b/gi;

export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'tooth'; value: string; toothNumber: number };

/**
 * Splits free text around `#36` / `tooth 36` mentions so the chart can link
 * valid FDI tooth numbers without ever interpreting or rewriting the note.
 */
export function segmentToothMentions(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  TOOTH_MENTION_RE.lastIndex = 0;

  for (const match of text.matchAll(TOOTH_MENTION_RE)) {
    const index = match.index ?? 0;
    const raw = match[0];
    const toothNumber = Number(match[1]);
    if (index > cursor) segments.push({ type: 'text', value: text.slice(cursor, index) });
    if (isValidToothNumber(toothNumber)) {
      segments.push({ type: 'tooth', value: raw, toothNumber });
    } else {
      segments.push({ type: 'text', value: raw });
    }
    cursor = index + raw.length;
  }
  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) });
  return mergeAdjacentText(segments);
}

/** Keep the rendered note identical: collapse neighbouring plain-text pieces. */
function mergeAdjacentText(segments: TextSegment[]): TextSegment[] {
  const out: TextSegment[] = [];
  for (const segment of segments) {
    const previous = out[out.length - 1];
    if (previous?.type === 'text' && segment.type === 'text') {
      out[out.length - 1] = { type: 'text', value: previous.value + segment.value };
    } else {
      out.push(segment);
    }
  }
  return out;
}

export function toothMentionsIn(text: string): number[] {
  const found = new Set<number>();
  for (const segment of segmentToothMentions(text)) {
    if (segment.type === 'tooth') found.add(segment.toothNumber);
  }
  return [...found];
}

type SearchItem = { kind: string; text: string };
type SearchSurface = { surface: string; note?: string | null };
type SearchTooth = {
  toothNumber: number;
  finding?: string | null;
  note?: string | null;
  surfaces?: readonly SearchSurface[];
};
type SearchVisit = {
  visitDate: Date | string;
  body?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  diagnosis?: string | null;
  materials?: string | null;
  anesthesia?: string | null;
};
type SearchPlan = {
  procedureName: string;
  status?: string | null;
  toothNumber?: number | null;
  notes?: string | null;
};

export type ClinicalSearchInput = {
  patientName: string;
  idNo?: string | null;
  historyNotes?: string | null;
  items?: readonly SearchItem[];
  teeth?: readonly SearchTooth[];
  visits?: readonly SearchVisit[];
  plans?: readonly SearchPlan[];
};

function dateKey(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** Deterministic, human-readable text indexed with `to_tsvector('simple', …)`. */
export function buildClinicalSearchText(input: ClinicalSearchInput): string {
  const parts: string[] = [];
  const add = (label: string, value: string | null | undefined): void => {
    const text = value?.trim();
    if (text) parts.push(`${label}: ${text}`);
  };

  add('patient', input.patientName);
  add('id', input.idNo);

  for (const item of input.items ?? []) add(item.kind, item.text);
  add('history notes', input.historyNotes);

  for (const tooth of input.teeth ?? []) {
    const label = `tooth ${tooth.toothNumber}`;
    add(label, tooth.finding);
    add(`${label} note`, tooth.note);
    for (const surface of tooth.surfaces ?? []) {
      add(`${label} ${surface.surface}`, surface.note);
    }
  }

  for (const visit of input.visits ?? []) {
    const label = `visit ${dateKey(visit.visitDate)}`;
    add(label, visit.body);
    add(`${label} subjective`, visit.subjective);
    add(`${label} objective`, visit.objective);
    add(`${label} assessment`, visit.assessment);
    add(`${label} plan`, visit.plan);
    add(`${label} diagnosis`, visit.diagnosis);
    add(`${label} materials`, visit.materials);
    add(`${label} anesthesia`, visit.anesthesia);
  }

  for (const plan of input.plans ?? []) {
    const label = plan.toothNumber ? `plan tooth ${plan.toothNumber}` : 'plan';
    add(label, plan.procedureName);
    add(`${label} status`, plan.status);
    add(`${label} notes`, plan.notes);
  }

  return parts.join('\n');
}
