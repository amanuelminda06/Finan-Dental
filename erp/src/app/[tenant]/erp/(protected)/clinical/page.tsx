import { TenantLink as Link } from '@/components/tenant-navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePageRole } from '@/lib/require-role';
import { formatInTz } from '@/lib/datetime';
import { formatPhoneDisplay } from '@/lib/phone';
import { getSettingsMap, timezoneFrom } from '@/modules/settings';
import { CLINICAL_ROLES, listClinicalPatients } from '@/modules/clinical';

type SearchParams = Promise<{ q?: string }>;

export default async function ClinicalPatientsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(CLINICAL_ROLES);
  const sp = await searchParams;
  const q = sp.q?.slice(0, 100) ?? '';
  const [t, tc, locale, settings, patients] = await Promise.all([
    getTranslations('clinical'),
    getTranslations('common'),
    getLocale(),
    getSettingsMap(),
    listClinicalPatients(q),
  ]);
  const tz = timezoneFrom(settings);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('intro')}</p>
      </div>

      <form method="get" className="card flex flex-wrap gap-2 p-3">
        <div className="min-w-56 flex-1">
          <label className="label text-xs" htmlFor="clinical-q">
            {tc('search')}
          </label>
          <input
            id="clinical-q"
            name="q"
            type="search"
            className="input-field text-sm"
            defaultValue={q}
            placeholder={t('searchPatientPlaceholder')}
          />
        </div>
      </form>

      <div className="card overflow-hidden">
        {patients.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">{tc('noResults')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">{t('patient')}</th>
                <th className="px-4 py-2">{t('idNo')}</th>
                <th className="px-4 py-2">{t('phone')}</th>
                <th className="px-4 py-2">{t('visits')}</th>
                <th className="px-4 py-2">{t('lastVisit')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{patient.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{patient.idNo ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatPhoneDisplay(patient.phoneE164)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{patient.visitCount}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {patient.lastVisitAt
                      ? formatInTz(patient.lastVisitAt, tz, { dateStyle: 'medium' }, locale)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/clinical/${patient.id}`} className="btn-secondary text-xs">
                      {t('openChart')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
