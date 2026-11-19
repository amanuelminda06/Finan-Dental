'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useTenantRouter as useRouter } from '@/components/tenant-navigation';
import { useTranslations } from 'next-intl';
import ActionError from '@/components/ActionError';
import type { ActionResult } from '@/lib/action';
import { createClinicalVisitAction } from '../actions';

type Suggestion = { id: string; category: string; label: string };

type Props = {
  patientId: string;
  today: string;
  suggestions: Suggestion[];
};

const OPTIONAL_FIELDS: Array<{ name: string; labelKey: string; category?: string; rows?: number }> = [
  { name: 'subjective', labelKey: 'subjective', rows: 2 },
  { name: 'objective', labelKey: 'objective', rows: 2 },
  { name: 'assessment', labelKey: 'assessment', rows: 2 },
  { name: 'plan', labelKey: 'planText', rows: 2 },
  { name: 'diagnosis', labelKey: 'diagnosis', category: 'diagnosis' },
  { name: 'materials', labelKey: 'materials', category: 'material' },
  { name: 'anesthesia', labelKey: 'anesthesia', category: 'anesthesia' },
];

export default function VisitNoteForm({ patientId, today, suggestions }: Props) {
  const router = useRouter();
  const t = useTranslations('clinical');
  const tc = useTranslations('common');
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createClinicalVisitAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="card space-y-3 p-5">
      <input type="hidden" name="patientId" value={patientId} />
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{t('visitTitle')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('visitIntro')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label text-xs" htmlFor="clinical-visit-date">
            {t('visitDate')}
          </label>
          <input
            id="clinical-visit-date"
            name="visitDate"
            type="date"
            className="input-field text-sm"
            defaultValue={today}
            required
          />
        </div>
      </div>

      <div>
        <label className="label text-xs" htmlFor="clinical-visit-body">
          {t('visitBody')}
        </label>
        <textarea
          id="clinical-visit-body"
          name="body"
          className="input-field min-h-28"
          rows={5}
          maxLength={4000}
          placeholder={t('visitBodyPlaceholder')}
        />
      </div>

      <details className="rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600">
          {t('optionalDetails')}
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {OPTIONAL_FIELDS.map((field) => {
            const id = `clinical-visit-${field.name}`;
            const options = field.category
              ? suggestions.filter((item) => item.category === field.category)
              : [];
            return (
              <div key={field.name}>
                <label className="label text-xs" htmlFor={id}>
                  {t(field.labelKey as never)}
                </label>
                {field.category ? (
                  <input
                    id={id}
                    name={field.name}
                    className="input-field text-sm"
                    list={`clinical-visit-${field.category}`}
                    maxLength={300}
                  />
                ) : (
                  <textarea
                    id={id}
                    name={field.name}
                    className="input-field text-sm"
                    rows={field.rows ?? 2}
                    maxLength={4000}
                  />
                )}
                {field.category ? (
                  <datalist id={`clinical-visit-${field.category}`}>
                    {options.map((option) => (
                      <option key={option.id} value={option.label} />
                    ))}
                  </datalist>
                ) : null}
              </div>
            );
          })}
        </div>
      </details>

      <ActionError error={state && !state.ok ? state.error : undefined} />
      {state?.ok ? <p className="text-xs font-medium text-emerald-600">{tc('saved')}</p> : null}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? tc('saving') : t('addVisit')}
        </button>
      </div>
    </form>
  );
}
