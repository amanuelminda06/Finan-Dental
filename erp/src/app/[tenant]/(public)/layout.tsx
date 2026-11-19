import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { clinicDateKey } from '@/lib/datetime';
import { telLink } from '@/lib/phone';
import { getRequestTenant } from '@/lib/tenant-request';
import { tenantPath } from '@/lib/tenant-path';
import {
  getClinicProfile,
  getPublicServices,
  getSiteContent,
  isAnnouncementVisible,
  pick,
  siteBaseUrl,
} from '@/modules/public-site';
import { socialHref, telegramHref } from '@/modules/public-site/format';
import { getTenantBrand } from '@/modules/tenant-brand/queries';
import PublicHeader from '@/modules/public-site/components/PublicHeader';
import PublicFooter from '@/modules/public-site/components/PublicFooter';
import AnnouncementBanner from '@/modules/public-site/components/AnnouncementBanner';
import Analytics from '@/modules/public-site/components/Analytics';
import JsonLd from '@/modules/public-site/components/JsonLd';

// These pages embed current-time state (announcement windows, "on duty now")
// and query the DB per request — render them on demand instead of as a shell.
// export const ensureStatic = false;

// export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const [tenant, brand] = await Promise.all([getRequestTenant(), getTenantBrand()]);
  return {
    metadataBase: new URL(siteBaseUrl()),
    applicationName: brand.clinicName,
    openGraph: {
      siteName: brand.clinicName,
      url: `${siteBaseUrl()}${tenantPath(tenant.slug)}`,
    },
  };
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [content, profile, services, brand, tenant] = await Promise.all([
    getSiteContent(),
    getClinicProfile(),
    getPublicServices(),
    getTenantBrand(),
    getRequestTenant(),
  ]);
  const locale = await getLocale();
  const t = await getTranslations('site');

  const clinicName = brand.clinicName;
  const address = brand.address;
  const phonePrimary = brand.phones[0] ?? null;
  const phoneHref = telLink(phonePrimary);
  const hoursText = null;
  const footerNote = pick(locale, content.footer_note) || null;
  const announcementText = pick(locale, content.announcement_text);

  const socials = [
    {
      href: telegramHref(brand.socials.telegram),
      label: 'Telegram',
      platform: 'telegram' as const,
    },
    {
      href: socialHref(brand.socials.instagram, 'instagram.com'),
      label: 'Instagram',
      platform: 'instagram' as const,
    },
    {
      href: socialHref(brand.socials.tiktok, 'tiktok.com'),
      label: 'TikTok',
      platform: 'tiktok' as const,
    },
  ].filter((item): item is { href: string; label: string; platform: 'telegram' | 'instagram' | 'tiktok' } => !!item.href);

  const showAnnouncement = isAnnouncementVisible(
    content,
    new Date(),
    profile.timezone,
    clinicDateKey,
  );

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: clinicName,
    url: `${siteBaseUrl()}${tenantPath(tenant.slug)}`,
    ...(phoneHref ? { telephone: phoneHref.slice(4) } : {}),
    ...(brand.email ? { email: brand.email } : {}),
    ...(address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: address,
            addressLocality: pick(locale, content.city),
            addressCountry: pick(locale, content.country),
          },
        }
      : {}),
    ...(hoursText ? { openingHours: hoursText } : {}),
    medicalSpecialty: 'Dentistry',
    ...(services.length
      ? {
          availableService: services.map((service) => ({
            '@type': 'MedicalProcedure',
            name: locale === 'am' ? service.nameAm : service.nameEn,
          })),
        }
      : {}),
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-800 focus:px-4 focus:py-2 focus:text-brand-primary-contrast"
      >
        {t('skipToContent')}
      </a>
      <PublicHeader clinicName={clinicName} phoneHref={phoneHref} logoUrl={brand.logoUrl} />
      <main id="main" className="flex-1">
        {showAnnouncement ? <AnnouncementBanner text={announcementText} /> : null}
        {children}
      </main>
      <PublicFooter
        clinicName={clinicName}
        address={address}
        phone={phonePrimary}
        phoneHref={phoneHref}
        hoursText={hoursText}
        footerNote={footerNote}
        socials={socials}
        mapLat={pick(locale, content.map_lat)}
        mapLng={pick(locale, content.map_lng)}
        mapZoom={pick(locale, content.map_zoom)}
      />
      <JsonLd data={jsonLd} />
      <Analytics />
    </div>
  );
}
