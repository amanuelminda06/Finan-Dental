import { getTranslations } from 'next-intl/server';
import { env } from '@/env';

/**
 * Unknown, suspended, expired and foreign-session tenant URLs are answered with
 * a plain 404 by the proxy. This page gives visitors a way back without
 * revealing whether a clinic exists.
 */
export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-6xl font-semibold text-slate-300">404</p>
      <h1 className="text-2xl font-semibold text-slate-900">{t('message')}</h1>
      <p className="text-slate-600">{t('detail')}</p>
      <a
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        href={`/${env.DEFAULT_TENANT_SLUG}`}
      >
        {t('home')}
      </a>
    </main>
  );
}
