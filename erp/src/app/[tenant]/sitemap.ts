import type { MetadataRoute } from 'next';
import { siteBaseUrl } from '@/modules/public-site/seo';
import { tenantPath } from '@/lib/tenant-path';
import { getRequestTenant } from '@/lib/tenant-request';

const PATHS = ['/', '/about', '/services', '/doctors', '/book', '/contact', '/faq', '/privacy'];

/** Sitemap for this clinic only — absolute URLs under its own URL tree. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { slug } = await getRequestTenant();
  const origin = siteBaseUrl();
  const lastModified = new Date();
  return PATHS.map((path) => {
    const url = `${origin}${tenantPath(slug, path)}`;
    return {
      url,
      lastModified,
      changeFrequency: 'monthly',
      priority: path === '/' ? 1 : 0.7,
      alternates: {
        languages: {
          en: `${url}?lang=en`,
          am: `${url}?lang=am`,
        },
      },
    };
  });
}
