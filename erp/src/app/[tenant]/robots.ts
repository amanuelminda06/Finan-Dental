import type { MetadataRoute } from 'next';
import { siteBaseUrl } from '@/modules/public-site';
import { tenantAppPath, tenantPath } from '@/lib/tenant-path';
import { getRequestTenant } from '@/lib/tenant-request';

/** Robots rules and sitemap reference scoped to this clinic's URL tree. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { slug } = await getRequestTenant();
  const origin = siteBaseUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: tenantPath(slug),
        disallow: [
          `${tenantPath(slug)}/login`,
          tenantPath(slug, '/api'),
          tenantAppPath(slug, '/settings'),
        ],
      },
    ],
    sitemap: `${origin}${tenantPath(slug, '/sitemap.xml')}`,
    host: `${origin}${tenantPath(slug)}`,
  };
}
