import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/tenant-context';
import {
  CLINICAL_SUGGESTION_DEFAULTS,
  CUSTOM_COLOR,
  SUGGESTION_CATEGORIES,
  SUGGESTION_COLORS,
} from './constants';
import { buildClinicalSearchText, normalizeSuggestionLabel } from './text';

/** Seed the clinic's own suggested wording once per category, on first use. */
export async function ensureClinicalSuggestions(): Promise<void> {
  const existing = await prisma.clinicalSuggestion.findMany({
    where: { isCustom: false },
    select: { category: true },
  });
  const seeded = new Set(existing.map((row) => row.category));
  const missing = SUGGESTION_CATEGORIES.filter((category) => !seeded.has(category));
  if (missing.length === 0) return;

  const tenantId = await getTenantId();
  const data = missing.flatMap((category) =>
    CLINICAL_SUGGESTION_DEFAULTS[category].map((label) => ({
      tenantId,
      category,
      label,
      normalizedKey: normalizeSuggestionLabel(label),
      color: SUGGESTION_COLORS[category],
      isCustom: false,
    })),
  );

  await prisma.clinicalSuggestion.createMany({ data, skipDuplicates: true });
}

export async function listClinicalSuggestions(): Promise<
  Array<{ id: string; category: string; label: string; color: string; isCustom: boolean }>
> {
  await ensureClinicalSuggestions();
  return prisma.clinicalSuggestion.findMany({
    where: { active: true },
    select: { id: true, category: true, label: true, color: true, isCustom: true },
    orderBy: [{ category: 'asc' }, { label: 'asc' }],
  });
}

/** Patient picker for the doctor-only chart (never uses non-clinical notes). */
export async function listClinicalPatients(query: string): Promise<
  Array<{
    id: string;
    fullName: string;
    idNo: string | null;
    phoneE164: string;
    visitCount: number;
    lastVisitAt: Date | null;
  }>
> {
  const rows = await prisma.patient.findMany({
    where: query
      ? {
          OR: [
            { fullName: { contains: query, mode: 'insensitive' } },
            { idNo: { contains: query, mode: 'insensitive' } },
            { phoneE164: { contains: query } },
          ],
        }
      : {},
    select: {
      id: true,
      fullName: true,
      idNo: true,
      phoneE164: true,
      clinicalVisits: { select: { visitDate: true }, orderBy: { visitDate: 'desc' }, take: 1 },
      _count: { select: { clinicalVisits: true } },
    },
    orderBy: { fullName: 'asc' },
    take: 300,
  });
  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    idNo: row.idNo,
    phoneE164: row.phoneE164,
    visitCount: row._count.clinicalVisits,
    lastVisitAt: row.clinicalVisits[0]?.visitDate ?? null,
  }));
}

export async function listClinicalServices(): Promise<
  Array<{ id: string; name: string; currentPrice: string | null }>
> {
  const services = await prisma.service.findMany({
    where: { active: true, isPublic: true },
    select: { id: true, name: true, currentPrice: true },
    orderBy: { name: 'asc' },
    take: 500,
  });
  return services.map((service) => ({
    id: service.id,
    name: service.name,
    currentPrice: service.currentPrice?.toString() ?? null,
  }));
}

export async function getClinicalChart(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      fullName: true,
      idNo: true,
      phoneE164: true,
      preferredLanguage: true,
      birthDate: true,
      active: true,
    },
  });
  if (!patient) return null;

  await ensureClinicalSuggestions();

  const [suggestions, profile, textItems, teeth, visits, planItems] = await Promise.all([
    prisma.clinicalSuggestion.findMany({
      where: { active: true },
      select: { id: true, category: true, label: true, color: true, isCustom: true },
      orderBy: [{ category: 'asc' }, { label: 'asc' }],
    }),
    prisma.clinicalProfile.findUnique({ where: { patientId } }),
    prisma.clinicalTextItem.findMany({
      where: { patientId },
      orderBy: [{ kind: 'asc' }, { text: 'asc' }],
    }),
    prisma.clinicalTooth.findMany({
      where: { patientId },
      include: { surfaces: { orderBy: { surface: 'asc' } } },
      orderBy: { toothNumber: 'asc' },
    }),
    prisma.clinicalVisit.findMany({
      where: { patientId },
      orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    prisma.clinicalPlanItem.findMany({
      where: { patientId },
      include: { service: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    }),
  ]);

  return {
    patient,
    suggestions,
    profile: profile ?? null,
    textItems,
    teeth,
    visits,
    planItems,
  };
}

export type ClinicalChartData = NonNullable<Awaited<ReturnType<typeof getClinicalChart>>>;

/** Rebuild the single maintained FTS row after any clinical mutation. */
export async function rebuildClinicalSearchText(patientId: string): Promise<void> {
  const [patient, profile, items, teeth, visits, plans] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, fullName: true, idNo: true },
    }),
    prisma.clinicalProfile.findUnique({ where: { patientId }, select: { historyNotes: true } }),
    prisma.clinicalTextItem.findMany({
      where: { patientId },
      select: { kind: true, text: true },
    }),
    prisma.clinicalTooth.findMany({
      where: { patientId },
      select: {
        toothNumber: true,
        finding: true,
        note: true,
        surfaces: { select: { surface: true, note: true } },
      },
    }),
    prisma.clinicalVisit.findMany({
      where: { patientId },
      select: {
        visitDate: true,
        body: true,
        subjective: true,
        objective: true,
        assessment: true,
        plan: true,
        diagnosis: true,
        materials: true,
        anesthesia: true,
      },
    }),
    prisma.clinicalPlanItem.findMany({
      where: { patientId },
      select: { procedureName: true, status: true, toothNumber: true, notes: true },
    }),
  ]);
  if (!patient) return;

  const searchText = buildClinicalSearchText({
    patientName: patient.fullName,
    idNo: patient.idNo,
    historyNotes: profile?.historyNotes,
    items,
    teeth,
    visits,
    plans,
  });

  await prisma.clinicalSearch.upsert({
    where: { patientId },
    create: { tenantId: await getTenantId(), patientId, searchText },
    update: { searchText },
  });
}

/** True Postgres full-text search over the patient's maintained chart text. */
export async function searchClinicalText(
  patientId: string,
  query: string,
): Promise<{ excerpt: string } | null> {
  const tenantId = await getTenantId();
  const rows = await prisma.$queryRaw<Array<{ searchText: string }>>`
    SELECT "searchText" FROM "ClinicalSearch"
    WHERE "tenantId" = ${tenantId}
      AND "patientId" = ${patientId}
      AND to_tsvector('simple', "searchText") @@ websearch_to_tsquery('simple', ${query})
    LIMIT 1
  `;
  const text = rows[0]?.searchText;
  if (!text) return null;
  return { excerpt: text.slice(0, 600) };
}

export async function getClinicalPlanItem(id: string) {
  return prisma.clinicalPlanItem.findUnique({
    where: { id },
    select: {
      id: true,
      patientId: true,
      procedureName: true,
      serviceId: true,
      unitPrice: true,
      status: true,
      saleId: true,
      tenantId: true,
      service: { select: { id: true, name: true, currentPrice: true, active: true } },
    },
  });
}

/** Remember a typed term so the next doctor gets it as a suggestion. */
export async function rememberCustomTerm(
  category: keyof typeof SUGGESTION_COLORS,
  label: string,
): Promise<void> {
  const text = label.trim();
  if (!text) return;
  const existing = await prisma.clinicalSuggestion.findFirst({
    where: { category, label: { equals: text, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return;

  await prisma.clinicalSuggestion.upsert({
    where: {
      tenantId_category_normalizedKey: {
        tenantId: await getTenantId(),
        category,
        normalizedKey: normalizeSuggestionLabel(text),
      },
    },
    create: {
      tenantId: await getTenantId(),
      category,
      label: text,
      normalizedKey: normalizeSuggestionLabel(text),
      color: SUGGESTION_COLORS[category],
      isCustom: true,
    },
    update: { active: true },
  });
}

export async function getToothColorsByFinding(finding: string): Promise<{
  color: string;
  isCustom: boolean;
}> {
  const label = finding.trim();
  const match = await prisma.clinicalSuggestion.findFirst({
    where: { category: 'toothFinding', label: { equals: label, mode: 'insensitive' } },
    select: { color: true, isCustom: true },
  });
  if (match) return { color: match.color, isCustom: match.isCustom };
  return { color: CUSTOM_COLOR, isCustom: true };
}

export async function rememberCustomFinding(finding: string): Promise<void> {
  const label = finding.trim();
  if (!label) return;
  const normalizedKey = normalizeSuggestionLabel(label);
  await prisma.clinicalSuggestion.upsert({
    where: {
      tenantId_category_normalizedKey: {
        tenantId: await getTenantId(),
        category: 'toothFinding',
        normalizedKey,
      },
    },
    create: {
      tenantId: await getTenantId(),
      category: 'toothFinding',
      label,
      normalizedKey,
      color: CUSTOM_COLOR,
      isCustom: true,
    },
    update: { active: true },
  });
}
