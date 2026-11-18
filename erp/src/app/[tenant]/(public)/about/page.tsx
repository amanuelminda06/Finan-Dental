import type { Metadata } from 'next';
import { getRequestTenant } from '@/lib/tenant-request';
import { TenantLink as Link } from '@/components/tenant-navigation';
import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/modules/public-site';
import { getTenantBrand } from '@/modules/tenant-brand/queries';
import TenantImage from '@/components/TenantImage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('site');
  const [{ slug }, brand] = await Promise.all([getRequestTenant(), getTenantBrand()]);
  return pageMetadata({
    tenant: slug,
    clinicName: brand.clinicName,
    title: t('meta.aboutTitle'),
    description: t('meta.aboutDescription', { clinic: brand.clinicName }),
    path: '/about',
  });
}

export default async function AboutPage() {
  const t = await getTranslations('site');
  const brand = await getTenantBrand();
  const body = t('meta.aboutDescription', { clinic: brand.clinicName })
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        {t('meta.aboutTitle')}
      </h1>
      <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-700">
        {body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {(
          [
            ['home.why1Title', 'home.why1Text'],
            ['home.why2Title', 'home.why2Text'],
            ['home.why3Title', 'home.why3Text'],
          ] as const
        ).map(([titleKey, textKey]) => (
          <div key={titleKey} className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">{t(titleKey)}</h2>
            <p className="mt-2 text-sm text-slate-600">{t(textKey)}</p>
          </div>
        ))}
      </div>

      {brand.doctorName ? (
        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-5">
            {brand.doctorPhotoUrl ? (
              <TenantImage
                src={brand.doctorPhotoUrl}
                alt={brand.doctorName}
                width={96}
                height={96}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : null}
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{brand.doctorName}</h2>
              {brand.doctorTitle ? (
                <p className="text-sm font-medium text-brand-800">{brand.doctorTitle}</p>
              ) : null}
              {brand.doctorBio ? <p className="mt-2 text-slate-600">{brand.doctorBio}</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/book"
          className="rounded-xl bg-brand-800 px-6 py-3 text-base font-semibold text-brand-primary-contrast hover:bg-brand-900"
        >
          {t('bookAppointment')}
        </Link>
        <Link
          href="/doctors"
          className="rounded-lg border border-slate-300 px-6 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50"
        >
          {t('navDoctors')}
        </Link>
      </div>
    </div>
  );
}
