import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Noto_Sans_Ethiopic } from 'next/font/google';
import { brand } from '@/config/brand';
import './globals.css';

const notoSansEthiopic = Noto_Sans_Ethiopic({ subsets: ['ethiopic', 'latin'], variable: '--font-noto-sans-ethiopic' });

// Every route in this ERP is session- and locale-dependent (dynamic by
// design) — opt out of the static-shell requirement for the whole app.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { default: brand.clinicName, template: `%s · ${brand.clinicName}` },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={notoSansEthiopic.variable}
      style={
        {
          '--finan-brand-primary': brand.colors.primary,
          '--finan-brand-secondary': brand.colors.secondary,
          '--finan-brand-accent': brand.colors.accent,
          '--finan-brand-primary-contrast': '#FFFFFF',
          '--finan-brand-secondary-contrast': '#0F172A',
        } as React.CSSProperties
      }
    >
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
