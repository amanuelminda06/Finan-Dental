'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTenantRouter as useRouter } from '@/components/tenant-navigation';
import { useTranslations } from 'next-intl';
import ActionError from '@/components/ActionError';
import type { ActionResult } from '@/lib/action';
import { saveClinicalProfileAction } from '../actions';

type FieldKey = 'conditions' | 'allergies' | 'medications' | 'habits' | 'history';

type Suggestion = { id: string; category: string; label: string; color: string; isCustom: boolean };

type Props = {
  patientId: string;
  initial: Record<FieldKey, string[]>;
  historyNotes: string;
  suggestions: Suggestion[];
};

const FIELDS: Array<{ field: FieldKey; category: string; labelKey: string }> = [
  { field: 'conditions', category: 'condition', labelKey: 'conditions' },
  { field: 'allergies', category: 'allergy', labelKey: 'allergies' },
  { field: 'medications', category: 'medication', labelKey: 'medications' },
  { field: 'habits', category: 'habit', labelKey: 'habits' },
  { field: 'history', category: 'history', labelKey: 'history' },
];

export default function ClinicalProfileForm({
  patientId,
  initial,
  historyNotes,
  suggestions,
}: Props) {
  const router = useRouter();
  const t = useTranslations('clinical');
  const tc = useTranslations('common');
  const tv = useTranslations('validation');
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveClinicalProfileAction,
    null,
  );
  const [items, setItems] = useState<Record<FieldKey, string[]>>(initial);
  const [drafts, setDrafts] = useState<Record<FieldKey, string>>({
    conditions: '',
    allergies: '',
    medications: '',
    habits: '',
    history: '',
  });

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const fieldError = (key: string): string | undefined =>
    state && !state.ok && state.fields?.[key]
      ? tv(state.fields[key] as never)
      : undefined;

  function add(field: FieldKey): void {
    const value = drafts[field].trim();
    if (!value) return;
    setItems((current) => {
      if (current[field].some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
        return current;
      }
      return { ...current, [field]: [...current[field], value] };
    });
    setDrafts((current) => ({ ...current, [field]: '' }));
  }

  function remove(field: FieldKey, value: string): void {
    setItems((current) => ({
      ...current,
      [field]: current[field].filter((item) => item !== value),
    }));
  }

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <input type="hidden" name="patientId" value={patientId} />
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{t('historyTitle')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('historyIntro')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {FIELDS.map(({ field, category, labelKey }) => {
          const datalistId = `clinical-suggestions-${category}`;
          const options = suggestions.filter((item) => item.category === category);
          return (
            <div key={field} className="rounded-lg border border-slate-200 p-3">
              <label className="label text-xs" htmlFor={`clinical-${field}`}>
                {t(labelKey as never)}
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id={`clinical-${field}`}
                  className="input-field text-sm"
                  list={datalistId}
                  value={drafts[field]}
                  maxLength={300}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [field]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      add(field);
                    }
                  }}
                />
                <datalist id={datalistId}>
                  {options.map((option) => (
                    <option key={option.id} value={option.label} />
                  ))}
                </datalist>
                <button type="button" className="btn-secondary" onClick={() => add(field)}>
                  {t('add')}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {items[field].length === 0 ? (
                  <span className="text-xs text-slate-400">{tc('empty')}</span>
                ) : (
                  items[field].map((value) => (
                    <span
                      key={value}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-900"
                    >
                      {value}
                      <button
                        type="button"
                        className="text-brand-700 hover:text-red-600"
                        aria-label={`${t('remove')}: ${value}`}
                        onClick={() => remove(field, value)}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              <input
                type="hidden"
                name={field}
                value={JSON.stringify(items[field])}
                aria-invalid={!!fieldError(field)}
              />
              {fieldError(field) ? (
                <p className="mt-1 text-xs font-medium text-red-600">{fieldError(field)}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div>
        <label className="label text-xs" htmlFor="clinical-history-notes">
          {t('otherNotes')}
        </label>
        <textarea
          id="clinical-history-notes"
          name="historyNotes"
          className="input-field min-h-20"
          rows={3}
          maxLength={4000}
          defaultValue={historyNotes}
        />
      </div>

      <ActionError error={state && !state.ok ? state.error : undefined} />
      {state?.ok ? <p className="text-xs font-medium text-emerald-600">{tc('saved')}</p> : null}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? tc('saving') : tc('save')}
        </button>
      </div>
    </form>
  );
}
