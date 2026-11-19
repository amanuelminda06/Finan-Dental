import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TenantPathProvider } from '@/components/tenant-navigation';
import TenantAuthProvider from '@/components/TenantAuthProvider';
import { getRequestTenant } from '@/lib/tenant-request';
import { brandCssVars } from '@/modules/tenant-brand/defaults';
import { getTenantBrand } from '@/modules/tenant-brand/queries';

/**
 * One gate for the whole clinic URL tree. The proxy already returns 404 for
 * unknown/suspended/expired tenants; this layout re-checks that the URL slug
 * matches the resolved request tenant so a rewrite or a direct render can never
 * mix two clinics. A session from another clinic is allowed to view the public
 * site; protected pages additionally call assertSessionTenant().
 *
 * Deliberately contains no site chrome: every public page (including the
 * home page) lives in the `/(public)` route group, while the ERP is a sibling
 * path. This keeps the public header/footer off ERP screens. The brand
 * variables below override the neutral root values for every page in this clinic.
 */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getTenantBrand();
  return {
    title: { default: brand.clinicName, template: `%s · ${brand.clinicName}` },
  };
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const [{ tenant: slug }, requestTenant] = await Promise.all([params, getRequestTenant()]);
  if (requestTenant.slug !== slug) notFound();
  const brand = await getTenantBrand();
  return (
    <div style={brandCssVars(brand) as React.CSSProperties}>
      <TenantPathProvider slug={slug}>
        <TenantAuthProvider slug={slug}>{children}</TenantAuthProvider>
      </TenantPathProvider>
    </div>
  );
}
