import { getRequestTenant } from './tenant-request';
import { tenantHref, type TenantArea } from './tenant-path';

/** Resolve a root-relative path against the tenant from the current URL. */
export async function tenantServerHref(path: string, area: TenantArea = 'app'): Promise<string> {
  const tenant = await getRequestTenant();
  return tenantHref(path, tenant.slug, area);
}

/** Absolute URL for a redirect inside a route handler. */
export async function tenantServerUrl(
  request: Request,
  path: string,
  area: TenantArea = 'app',
): Promise<string> {
  return new URL(await tenantServerHref(path, area), request.url).toString();
}
