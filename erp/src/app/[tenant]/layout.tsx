import { notFound } from 'next/navigation';
import { TenantPathProvider } from '@/components/tenant-navigation';
import TenantAuthProvider from '@/components/TenantAuthProvider';
import { getRequestTenant } from '@/lib/tenant-request';

/**
 * One gate for the whole clinic URL tree. The proxy already returns 404 for
 * unknown/suspended/expired tenants and for a session bound to another tenant;
 * this layout re-checks that the URL slug matches the resolved request tenant
 * so a rewrite or a direct render can never mix two clinics.
 *
 * Deliberately contains no site chrome: the public site and the ERP are
 * siblings below this segment, so the ERP does not inherit the public header
 * and footer.
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const [{ tenant: slug }, requestTenant] = await Promise.all([params, getRequestTenant()]);
  if (requestTenant.slug !== slug) notFound();
  return (
    <TenantPathProvider slug={slug}>
      <TenantAuthProvider slug={slug}>{children}</TenantAuthProvider>
    </TenantPathProvider>
  );
}
