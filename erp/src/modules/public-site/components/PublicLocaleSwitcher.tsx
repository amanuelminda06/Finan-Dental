'use client';

import {
  useTenantHref,
  useTenantRouter as useRouter,
} from '@/components/tenant-navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';

const LOCALES: Array<{ code: Locale; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'am', label: 'አማ' },
];

function setLocaleCookie(code: Locale, path: string): void {
  document.cookie = `locale=${code}; path=${path}; max-age=31536000; samesite=lax`;
}

/**
 * Public language toggle. Uses a cookie scoped to this clinic's URL tree, so
 * switching keeps the visitor on exactly the page they are viewing and each
 * tenant keeps its own preference. The proxy also understands `?lang=en|am`
 * links (used for hreflang/crawlers).
 */
export default function PublicLocaleSwitcher() {
  const router = useRouter();
  const resolve = useTenantHref();
  const active = useLocale();
  const t = useTranslations('site');

  function switchTo(code: Locale) {
    setLocaleCookie(code, resolve('/'));
    router.refresh();
  }

  return (
    <div
      className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5"
      role="group"
      aria-label={t('languageLabel')}
    >
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          lang={code}
          onClick={() => switchTo(code)}
          aria-pressed={active === code}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            active === code ? 'bg-brand-800 text-brand-primary-contrast' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
