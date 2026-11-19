import { TenantLink as Link } from '@/components/tenant-navigation';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { requirePageRole } from '@/lib/require-role';
import {
  PrintButtons,
  ReceiptView,
  getSale,
} from '@/modules/sales';
import { settingsFromMap, getSettingsMap, timezoneFrom } from '@/modules/settings';
import { CLINICAL_ROLES } from '@/modules/clinical';

type Params = Promise<{ id: string }>;

/** Doctor-facing copy of a receipt created from a clinical treatment plan. */
export default async function ClinicalReceiptPage({ params }: { params: Params }) {
  await requirePageRole(CLINICAL_ROLES);
  const { id } = await params;
  const [sale, t, settings] = await Promise.all([
    getSale(id),
    getTranslations('clinical'),
    getSettingsMap(),
  ]);
  if (!sale || !sale.patient) notFound();

  const clinic = settingsFromMap(settings);
  const tz = timezoneFrom(settings);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/clinical/${sale.patient.id}`} className="btn-secondary">
            {t('receiptBack')}
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">{t('receiptTitle')}</h1>
        </div>
        <PrintButtons targetId="receipt" />
      </div>

      <ReceiptView
        sale={sale}
        clinicName={clinic.clinic_name}
        currency={clinic.currency}
        timeZone={tz}
      />
    </div>
  );
}
