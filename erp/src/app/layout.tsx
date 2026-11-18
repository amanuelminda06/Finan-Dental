import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Noto_Sans_Ethiopic } from 'next/font/google';
import { brandCssVars, neutralTenantBrand } from '@/modules/tenant-brand/defaults';
import './globals.css';

const notoSansEthiopic = Noto_Sans_Ethiopic({ subsets: ['ethiopic', 'latin'], variable: '--font-noto-sans-ethiopic' });

// Every route in this ERP is session- and locale-dependent (dynamic by
// design) — opt out of the static-shell requirement for the whole app.
// export const instant = false;

/** Neutral fallback used only outside a clinic URL tree. */
export const metadata: Metadata = {
  title: { default: 'Clinic', template: '%s · Clinic' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={notoSansEthiopic.variable}
      style={brandCssVars(neutralTenantBrand({ clinicName: 'Clinic' })) as React.CSSProperties}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
