import PrintPageButton from '@/components/PrintPageButton';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { requirePageRole } from '@/lib/require-role';
import { formatInTz } from '@/lib/datetime';
import { settingsFromMap, getSettingsMap, timezoneFrom } from '@/modules/settings';
import {
  CLINICAL_ROLES,
  PLAN_STATUS_LABEL_KEYS,
  getClinicalChart,
  type PlanStatus,
} from '@/modules/clinical';

type Params = Promise<{ patientId: string }>;

export default async function ClinicalPlanPrintPage({ params }: { params: Params }) {
  await requirePageRole(CLINICAL_ROLES);
  const { patientId } = await params;
  const chart = await getClinicalChart(patientId);
  if (!chart) notFound();

  const [t, settings] = await Promise.all([getTranslations('clinical'), getSettingsMap()]);
  const clinic = settingsFromMap(settings);
  const tz = timezoneFrom(settings);

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{t('printPlan')}</h1>
        <PrintPageButton />
      </div>

      <div id="clinical-plan-print" className="card space-y-4 p-6 text-slate-900">
        <header className="border-b border-slate-200 pb-3">
          <h2 className="text-lg font-semibold">{clinic.clinic_name}</h2>
          <p className="text-sm text-slate-600">
            {t('planPrintFor', { name: chart.patient.fullName })}
          </p>
          {chart.patient.idNo ? (
            <p className="text-xs text-slate-500">
              {t('idNo')}: {chart.patient.idNo}
            </p>
          ) : null}
        </header>

        {chart.planItems.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noPlanItems')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">{t('procedureName')}</th>
                <th className="px-3 py-2">{t('toothNumber')}</th>
                <th className="px-3 py-2">{t('status')}</th>
                <th className="px-3 py-2">{t('manualPrice')}</th>
                <th className="px-3 py-2">{t('procedureNotes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {chart.planItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-medium">{item.procedureName}</td>
                  <td className="px-3 py-2">{item.toothNumber ?? '—'}</td>
                  <td className="px-3 py-2">
                    {t(PLAN_STATUS_LABEL_KEYS[item.status as PlanStatus] as never)}
                  </td>
                  <td className="px-3 py-2">
                    {item.unitPrice ? item.unitPrice.toString() : t('noPrice')}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{item.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <footer className="border-t border-slate-200 pt-3 text-xs text-slate-500">
          {formatInTz(new Date(), tz, { dateStyle: 'medium' }, 'en-GB')}
        </footer>
      </div>
    </div>
  );
}
