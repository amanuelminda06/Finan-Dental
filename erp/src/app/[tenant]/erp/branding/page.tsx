import { getTranslations } from 'next-intl/server';
import { requirePageRole } from '@/lib/require-role';
import { TenantLink as Link } from '@/components/tenant-navigation';
import BrandingForm from '@/modules/tenant-brand/components/BrandingForm';
import { getTenantBrand } from '@/modules/tenant-brand/queries';

export const dynamic = 'force-dynamic';

/** OWNER-only clinic identity editor. Every value is scoped to this tenant. */
export default async function BrandingPage() {
  await requirePageRole(['OWNER']);
  const t = await getTranslations('branding');
  const brand = await getTenantBrand();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
        <Link href="/" target="_blank" className="btn-secondary">
          {t('viewSite')}
        </Link>
      </div>
      <p className="max-w-3xl text-sm text-slate-600">{t('intro')}</p>
      <BrandingForm initial={brand} />
    </div>
  );
}
