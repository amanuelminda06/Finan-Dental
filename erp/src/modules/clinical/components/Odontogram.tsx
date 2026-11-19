'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useTenantRouter as useRouter } from '@/components/tenant-navigation';
import { useTranslations } from 'next-intl';
import ActionError from '@/components/ActionError';
import type { ActionResult } from '@/lib/action';
import { saveClinicalToothAction } from '../actions';
import { SURFACES, TOOTH_NUMBERS } from '../constants';

export type ClinicalToothData = {
  toothNumber: number;
  finding: string | null;
  findingColor: string | null;
  findingIsCustom: boolean;
  note: string | null;
  surfaces: Array<{ surface: string; note: string | null }>;
};

type Suggestion = { id: string; category: string; label: string; color: string };

type Props = {
  patientId: string;
  teeth: ClinicalToothData[];
  findings: Suggestion[];
};

type ToothResult = ActionResult<{ id: string }> | null;

export default function Odontogram({ patientId, teeth, findings }: Props) {
  const t = useTranslations('clinical');
  const byNumber = new Map(teeth.map((tooth) => [tooth.toothNumber, tooth]));
  const [selected, setSelected] = useState(TOOTH_NUMBERS[0]);

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{t('odontogramTitle')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('odontogramIntro')}</p>
      </div>

      <div className="grid grid-cols-8 gap-1.5 sm:max-w-2xl">
        {TOOTH_NUMBERS.map((number) => {
          const tooth = byNumber.get(number);
          return (
            <button
              key={number}
              id={`tooth-${number}`}
              type="button"
              onClick={() => setSelected(number)}
              aria-label={`${t('toothLabel')} ${number}`}
              aria-pressed={selected === number}
              className={`flex flex-col items-center rounded-lg border px-1 py-2 text-xs font-semibold transition-colors ${
                selected === number
                  ? 'border-brand-600 bg-brand-100 text-brand-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-brand-50'
              }`}
            >
              <span
                className="mb-1 h-2 w-2 rounded-full"
                style={{ backgroundColor: tooth?.findingColor ?? 'transparent' }}
                aria-hidden
              />
              {number}
            </button>
          );
        })}
      </div>

      <ToothQuickBox
        key={`${selected}:${JSON.stringify(byNumber.get(selected) ?? null)}`}
        patientId={patientId}
        toothNumber={selected}
        tooth={byNumber.get(selected)}
        findings={findings}
      />
    </section>
  );
}

function ToothQuickBox({
  patientId,
  toothNumber,
  tooth,
  findings,
}: {
  patientId: string;
  toothNumber: number;
  tooth: ClinicalToothData | undefined;
  findings: Suggestion[];
}) {
  const router = useRouter();
  const t = useTranslations('clinical');
  const tc = useTranslations('common');
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction, pending] = useActionState<ToothResult, FormData>(
    saveClinicalToothAction,
    null,
  );
  const matchingSuggestion = findings.some((item) => item.label === tooth?.finding);
  const [suggested, setSuggested] = useState(matchingSuggestion ? (tooth?.finding ?? '') : '');
  const [custom, setCustom] = useState(matchingSuggestion ? '' : (tooth?.finding ?? ''));
  const surfaceKeys = [
    ...SURFACES,
    ...(tooth?.surfaces ?? [])
      .map((surface) => surface.surface)
      .filter((surface) => !(SURFACES as readonly string[]).includes(surface)),
  ];
  const [surfaceNotes, setSurfaceNotes] = useState<Record<string, string>>(
    Object.fromEntries((tooth?.surfaces ?? []).map((surface) => [surface.surface, surface.note ?? ''])),
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="rounded-lg border border-slate-200 p-4">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="toothNumber" value={toothNumber} />
      <input type="hidden" name="finding" value={custom.trim() || suggested} />
      <input type="hidden" name="surfaces" value={JSON.stringify(surfaceNotes)} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">
          {t('selectedTooth', { tooth: toothNumber })}
        </h3>
        {tooth?.findingColor ? (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: tooth.findingColor }}
          >
            {tooth.findingIsCustom ? t('customFindingLabel') : tooth.finding}
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="label text-xs" htmlFor="clinical-tooth-suggestion">
            {t('suggestedFinding')}
          </label>
          <select
            id="clinical-tooth-suggestion"
            className="input-field text-sm"
            value={suggested}
            onChange={(event) => {
              setSuggested(event.target.value);
              if (event.target.value) setCustom('');
            }}
          >
            <option value="">{tc('notSet')}</option>
            {findings.map((item) => (
              <option key={item.id} value={item.label}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs" htmlFor="clinical-tooth-finding">
            {t('customFinding')}
          </label>
          <input
            id="clinical-tooth-finding"
            className="input-field text-sm"
            value={custom}
            maxLength={300}
            onChange={(event) => {
              setCustom(event.target.value);
              if (event.target.value) setSuggested('');
            }}
          />
          <p className="mt-1 text-xs text-slate-400">{t('findingHint')}</p>
        </div>
      </div>

      <div className="mt-3">
        <label className="label text-xs" htmlFor="clinical-tooth-note">
          {t('toothNote')}
        </label>
        <textarea
          id="clinical-tooth-note"
          name="note"
          className="input-field min-h-16"
          rows={2}
          maxLength={4000}
          defaultValue={tooth?.note ?? ''}
        />
      </div>

      <div className="mt-3">
        <p className="label text-xs">{t('surfaceNotes')}</p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {surfaceKeys.map((surface) => (
            <div key={surface}>
              <label className="block text-xs capitalize text-slate-500" htmlFor={`surface-${surface}`}>
                {(SURFACES as readonly string[]).includes(surface)
                  ? t(`surface${surface.charAt(0).toUpperCase()}${surface.slice(1)}` as never)
                  : surface}
              </label>
              <input
                id={`surface-${surface}`}
                className="input-field mt-0.5 text-sm"
                maxLength={1000}
                value={surfaceNotes[surface] ?? ''}
                onChange={(event) =>
                  setSurfaceNotes((current) => ({
                    ...current,
                    [surface]: event.target.value,
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <ActionError error={state && !state.ok ? state.error : undefined} />
      {state?.ok ? <p className="mt-2 text-xs font-medium text-emerald-600">{tc('saved')}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? tc('saving') : tc('save')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => formRef.current?.reset()}
        >
          {tc('cancel')}
        </button>
      </div>
    </form>
  );
}
