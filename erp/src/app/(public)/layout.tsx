import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { brand } from '@/config/brand';
import { SERVICES } from '@/config/services';
import { clinicDateKey } from '@/lib/datetime';
import {
  getClinicProfile,
  getSiteContent,
  isAnnouncementVisible,
  pick,
  siteBaseUrl,
} from '@/modules/public-site';
import { telLink } from '@/config/brand';
import PublicHeader from '@/modules/public-site/components/PublicHeader';
import PublicFooter from '@/modules/public-site/components/PublicFooter';
import AnnouncementBanner from '@/modules/public-site/components/AnnouncementBanner';
import Analytics from '@/modules/public-site/components/Analytics';
import JsonLd from '@/modules/public-site/components/JsonLd';

// These pages embed current-time state (announcement windows, "on duty now")
// and query the DB per request — render them on demand instead of as a shell.
export const ensureStatic = false;

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getClinicProfile();
  return {
    metadataBase: new URL(siteBaseUrl()),
    applicationName: profile.name,
    openGraph: { siteName: profile.name },
  };
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [content, profile] = await Promise.all([getSiteContent(), getClinicProfile()]);
  const services = SERVICES;
  const locale = await getLocale();
  const t = await getTranslations('site');

  const clinicName = brand.clinicName;
  const address = brand.address;
  const phonePrimary = brand.phones[0];
  const phoneHref = telLink(phonePrimary);
  const hoursText = null;
  const footerNote = pick(locale, content.footer_note) || null;
  const announcementText = pick(locale, content.announcement_text);

  const socials = [
    { href: `https://t.me/${brand.telegram.slice(1)}`, label: 'Telegram', platform: 'telegram' as const },
  ];

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
    url: siteBaseUrl(),
    telephone: `+251${phonePrimary.slice(1)}`,
    email: brand.email,
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
      <PublicHeader clinicName={clinicName} phoneHref={phoneHref} />
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
