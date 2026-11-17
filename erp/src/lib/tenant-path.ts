import { parseTenantSlug } from './tenant-slug';

/**
 * URL helpers for a clinic-as-a-URL deployment.
 *
 * Public pages live at `/[tenant]/...`, the ERP at `/[tenant]/app/...` and APIs
 * at `/[tenant]/api/...`. Everything that produces a URL goes through here so
 * there is a single place to change the scheme (and so tests can assert it).
 */

export type TenantRef = string | { slug: string };

/** Which sibling tree a root-relative app path belongs to. */
export type TenantArea = 'app' | 'public';

function slugOf(tenant: TenantRef): string {
  const slug = typeof tenant === 'string' ? tenant : tenant.slug;
  if (!slug || /[\/?#]/.test(slug)) throw new Error(`Invalid tenant slug: ${slug}`);
  return slug;
}

/** Split a root-relative path into its pathname and query/hash suffix. */
function splitSuffix(path: string): { pathname: string; suffix: string } {
  const raw = path || '/';
  const at = raw.search(/[?#]/);
  return at === -1
    ? { pathname: raw, suffix: '' }
    : { pathname: raw.slice(0, at), suffix: raw.slice(at) };
}

function join(tenant: TenantRef, prefix: string, path: string): string {
  const { pathname, suffix } = splitSuffix(path);
  const rest = pathname
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter((part) => part && part !== '.')
    .join('/');
  const parts = [slugOf(tenant), prefix, rest].filter(Boolean);
  return `/${parts.join('/')}${suffix}`;
}

/** `/finan`, `/finan/about`, `/finan/patients?x=1` from a slug and a root path. */
export function tenantPath(tenant: TenantRef, path = '/'): string {
  return join(tenant, '', path);
}

/** ERP path: `/finan/app`, `/finan/app/patients`. */
export function tenantAppPath(tenant: TenantRef, path = '/'): string {
  return join(tenant, 'app', path);
}

/** API path: `/finan/api/search`. */
export function tenantApiPath(tenant: TenantRef, path = '/'): string {
  return join(tenant, 'api', path);
}

/** Shared static asset under a tenant URL: `/finan/static/hero.jpg`. */
export function tenantAssetPath(tenant: TenantRef, asset: string): string {
  return join(tenant, 'static', asset);
}

/** Login path: `/finan/login/<secret>`. */
export function tenantLoginPath(tenant: TenantRef, secret: string): string {
  return tenantPath(tenant, `/login/${encodeURIComponent(secret)}`);
}

/** Slug from the first path segment, or null for root/reserved/static paths. */
export function tenantFromPath(pathname: string): string | null {
  const first = (pathname ?? '').replace(/^\/+/, '').split('/')[0] ?? '';
  const parsed = parseTenantSlug(first);
  return parsed.ok ? parsed.slug : null;
}

/** True when `pathname` is under `tenant`'s URL tree. */
export function isTenantPath(pathname: string, tenant: TenantRef): boolean {
  const prefix = tenantPath(tenant);
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Rewrite a legacy root-relative href into this tenant's URL tree.
 *
 * Rules, in order:
 *  - Non-path values (`tel:`, `sms:`, `mailto:`, `https://`, `#…`) pass through.
 *  - Already tenant-prefixed paths pass through (so server-built hrefs are
 *    safe to hand to client links without double-prefixing).
 *  - `/api/…` is always an API path under the tenant.
 *  - `/static/…` is a shared asset under the tenant.
 *  - `/` is the tenant's public home, from either area.
 *  - Everything else is prefixed with the current area (`app` → `/[tenant]/app`,
 *    `public` → `/[tenant]`).
 */
export function tenantHref(
  href: string,
  tenant: TenantRef,
  area: TenantArea = 'public',
): string {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return href;
  const slug = slugOf(tenant);
  const prefix = `/${slug}`;
  if (href === prefix || href.startsWith(`${prefix}/`)) return href;
  if (href === '/api' || href.startsWith('/api/')) {
    return tenantApiPath(slug, href.slice('/api'.length) || '/');
  }
  if (href.startsWith('/static/')) return tenantAssetPath(slug, href.slice('/static'.length));
  if (href === '/') return tenantPath(slug, '/');
  return area === 'app' ? tenantAppPath(slug, href) : tenantPath(slug, href);
}
