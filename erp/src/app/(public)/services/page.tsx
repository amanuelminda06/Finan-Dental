import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import Reveal from '@/components/Reveal';
import { SERVICES } from '@/config/services';
import { pageMetadata } from '@/modules/public-site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('site');
  return pageMetadata({
    title: t('meta.servicesTitle'),
    description: t('meta.servicesDescription'),
    path: '/services',
  });
}

export default async function ServicesPage() {
  const t = await getTranslations('site');
  const locale = await getLocale();
  const services = SERVICES;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        {t('services.title')}
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-600">{t('services.intro')}</p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service, index) => {
          const name = locale === 'am' ? service.nameAm : service.nameEn;
          const description = locale === 'am' ? service.descriptionAm : service.descriptionEn;
          return (
            <Reveal delay={index * 60} key={service.nameEn}>
              <article className="card flex h-full flex-col overflow-hidden">
                <div className="relative aspect-[3/2] w-full bg-slate-100">
                  <Image
                    src={service.imageUrl}
                    alt={name}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="text-lg font-semibold text-slate-900">{name}</h2>
                  <p className="mt-2 flex-1 text-sm text-slate-600">{description}</p>
                  <Link href="/book" className="btn-primary mt-4 self-start">
                    {t('services.bookService')} →
                  </Link>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
