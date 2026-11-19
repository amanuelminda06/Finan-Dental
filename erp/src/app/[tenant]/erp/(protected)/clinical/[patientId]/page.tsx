import { TenantLink as Link } from '@/components/tenant-navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { formatInTz } from '@/lib/datetime';
import { requirePageRole } from '@/lib/require-role';
import { getSettingsMap, timezoneFrom } from '@/modules/settings';
import {
  CLINICAL_ROLES,
  ClinicalProfileForm,
  ClinicalSearch,
  MedicalAlertBanner,
  Odontogram,
  TEXT_KINDS,
  TreatmentPlan,
  VisitNoteForm,
  VisitNoteText,
  getClinicalChart,
  listClinicalServices,
  toothMentionsIn,
  type ClinicalPlanItemData,
  type ClinicalToothData,
  type PlanStatus,
  type TextKind,
} from '@/modules/clinical';

type Params = Promise<{ patientId: string }>;

const OPTIONAL_VISIT_FIELDS = [
  ['subjective', 'subjective'],
  ['objective', 'objective'],
  ['assessment', 'assessment'],
  ['plan', 'planText'],
  ['diagnosis', 'diagnosis'],
  ['materials', 'materials'],
  ['anesthesia', 'anesthesia'],
] as const;

export default async function ClinicalChartPage({ params }: { params: Params }) {
  const actor = await requirePageRole(CLINICAL_ROLES);
  const { patientId } = await params;
  const chart = await getClinicalChart(patientId);
  if (!chart) notFound();

  const [t, tc, locale, settings, services] = await Promise.all([
    getTranslations('clinical'),
    getTranslations('common'),
    getLocale(),
    getSettingsMap(),
    listClinicalServices(),
  ]);
  const tz = timezoneFrom(settings);

  const itemsByKind: Record<
    'conditions' | 'allergies' | 'medications' | 'habits' | 'history',
    string[]
  > = {
    conditions: [],
    allergies: [],
    medications: [],
    habits: [],
    history: [],
  };
  const KIND_TO_FIELD: Record<TextKind, keyof typeof itemsByKind> = {
    condition: 'conditions',
    allergy: 'allergies',
    medication: 'medications',
    habit: 'habits',
    history: 'history',
  };
  for (const item of chart.textItems) {
    if (TEXT_KINDS.includes(item.kind as TextKind)) {
      itemsByKind[KIND_TO_FIELD[item.kind as TextKind]].push(item.text);
    }
  }

  const teeth: ClinicalToothData[] = chart.teeth.map((tooth) => ({
    toothNumber: tooth.toothNumber,
    finding: tooth.finding,
    findingColor: tooth.findingColor,
    findingIsCustom: tooth.findingIsCustom,
    note: tooth.note,
    surfaces: tooth.surfaces.map((surface) => ({
      surface: surface.surface,
      note: surface.note,
    })),
  }));

  const planItems: ClinicalPlanItemData[] = chart.planItems.map((item) => ({
    id: item.id,
    procedureName: item.procedureName,
    serviceName: item.service?.name ?? null,
    unitPrice: item.unitPrice ? item.unitPrice.toString() : null,
    toothNumber: item.toothNumber,
    status: item.status as PlanStatus,
    notes: item.notes,
    saleId: item.saleId,
  }));

  const suggestionList = chart.suggestions.map((suggestion) => ({
    id: suggestion.id,
    category: suggestion.category,
    label: suggestion.label,
    color: suggestion.color,
    isCustom: suggestion.isCustom,
  }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/clinical" className="btn-secondary text-xs">
              {tc('back')}
            </Link>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
              {t('roleNote')}
            </span>
          </div>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">
            {t('chartTitle')}: {chart.patient.fullName}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {chart.patient.idNo ?? '—'} · {chart.patient.fullName}
          </p>
        </div>
      </div>

      <MedicalAlertBanner
        allergies={itemsByKind.allergies}
        conditions={itemsByKind.conditions}
      />

      <ClinicalSearch patientId={patientId} />

      <ClinicalProfileForm
        patientId={patientId}
        initial={itemsByKind}
        historyNotes={chart.profile?.historyNotes ?? ''}
        suggestions={suggestionList}
      />

      <Odontogram
        patientId={patientId}
        teeth={teeth}
        findings={suggestionList.filter((item) => item.category === 'toothFinding')}
      />

      <div className="space-y-4">
        <VisitNoteForm
          patientId={patientId}
          today={today}
          suggestions={suggestionList}
        />

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800">{t('visitHistory')}</h2>
          {chart.visits.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t('noVisits')}</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {chart.visits.map((visit) => {
                const mentions = new Set<number>();
                for (const value of [visit.body, ...OPTIONAL_VISIT_FIELDS.map(([key]) => visit[key])]) {
                  for (const number of toothMentionsIn(value ?? '')) mentions.add(number);
                }
                return (
                  <li key={visit.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-500">
                        {formatInTz(visit.visitDate, tz, { dateStyle: 'medium' }, locale)}
                      </p>
                      {mentions.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-xs text-slate-400">{t('toothMentions')}:</span>
                          {[...mentions].map((number) => (
                            <a
                              key={number}
                              href={`#tooth-${number}`}
                              className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800"
                            >
                              #{number}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-2">
                      <VisitNoteText text={visit.body} />
                    </div>
                    {OPTIONAL_VISIT_FIELDS.map(([key, labelKey]) =>
                      visit[key] ? (
                        <div key={key} className="mt-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {t(labelKey)}
                          </p>
                          <VisitNoteText text={visit[key]} />
                        </div>
                      ) : null,
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <TreatmentPlan
        patientId={patientId}
        services={services}
        procedureSuggestions={suggestionList.filter((item) => item.category === 'procedure')}
        items={planItems}
      />

      <p className="text-xs text-slate-400">{t('signedInAs', { name: actor.name })}</p>
    </div>
  );
}
