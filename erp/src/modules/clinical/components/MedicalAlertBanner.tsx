import { getTranslations } from 'next-intl/server';

type Props = {
  allergies: string[];
  conditions: string[];
};

/** Every allergy item appears here — suggestions never hide or filter alerts. */
export default async function MedicalAlertBanner({ allergies, conditions }: Props) {
  const t = await getTranslations('clinical');
  if (allergies.length === 0 && conditions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        {t('noAlerts')}
      </div>
    );
  }

  return (
    <section
      aria-label={t('alertTitle')}
      className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide">{t('alertTitle')}</h2>
      {allergies.length > 0 ? (
        <div className="mt-2">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t('allergies')}:{' '}
          </span>
          <span className="text-sm font-medium">{allergies.join(' · ')}</span>
        </div>
      ) : null}
      {conditions.length > 0 ? (
        <div className="mt-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t('conditions')}:{' '}
          </span>
          <span className="text-sm">{conditions.join(' · ')}</span>
        </div>
      ) : null}
    </section>
  );
}
