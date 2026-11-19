'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import ActionError from '@/components/ActionError';
import type { ActionResult } from '@/lib/action';
import { searchClinicalAction } from '../actions';

type Props = { patientId: string };

export default function ClinicalSearch({ patientId }: Props) {
  const t = useTranslations('clinical');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<
    ActionResult<{ excerpt: string } | null> | null,
    FormData
  >(searchClinicalAction, null);

  const searched = state?.ok === true;
  const excerpt = searched ? state.data?.excerpt ?? null : null;

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{t('searchTitle')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('searchIntro')}</p>
      </div>
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="patientId" value={patientId} />
        <label className="sr-only" htmlFor="clinical-chart-search">
          {tc('search')}
        </label>
        <input
          id="clinical-chart-search"
          name="query"
          type="search"
          className="input-field max-w-md flex-1 text-sm"
          placeholder={t('searchPlaceholder')}
          maxLength={200}
          required
        />
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? tc('loading') : t('searchButton')}
        </button>
      </form>

      <ActionError error={state && !state.ok ? state.error : undefined} />
      {searched ? (
        excerpt ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('searchFound')}
            </p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-slate-700">
              {excerpt}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t('searchNone')}</p>
        )
      ) : null}
    </section>
  );
}
