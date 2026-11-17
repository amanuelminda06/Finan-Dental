/**
 * Tenant slug rules (pure — unit tested).
 *
 * A slug is the tenant's public identifier (e.g. the `finan` in
 * `finan.<host>` or `/t/finan`). It must be DNS-friendly and safe in a URL
 * path, so the character set is deliberately narrow.
 */

export const TENANT_SLUG_MIN = 3;
export const TENANT_SLUG_MAX = 40;

/**
 * Paths, subdomains and asset names the platform already uses. A tenant may
 * never claim one of these, otherwise its slug would shadow real routes.
 */
export const RESERVED_SLUGS: readonly string[] = [
  'login',
  'logout',
  'api',
  'app',
  'admin',
  'administrator',
  '_next',
  'static',
  'public',
  'www',
  'assets',
  'robots',
  'sitemap',
  'favicon',
  'dashboard',
  'auth',
  'uploads',
  'jobs',
  'health',
  'healthz',
  'status',
  'webhooks',
  'billing',
  'signup',
  'register',
  'settings',
  'help',
  'support',
  'docs',
  'mail',
  'smtp',
  'cdn',
  'img',
  'images',
  'media',
  'files',
  'fonts',
  'service',
  'services',
  'contact',
  'about',
  'book',
  'privacy',
  'terms',
  'blog',
  'api-docs',
  'localhost',
  'test',
  'tests',
  'staging',
  'demo',
];

/** Why a slug was rejected — maps to `validation.*` i18n keys. */
export type TenantSlugError =
  | 'required'
  | 'tooShort'
  | 'tooLong'
  | 'invalidChars'
  | 'edgeHyphen'
  | 'reserved';

export type TenantSlugParse =
  | { ok: true; slug: string }
  | { ok: false; error: TenantSlugError };

const SLUG_RE = /^[a-z0-9-]+$/;

/** True when the slug is reserved (case-insensitive). */
export function isReservedSlug(input: string): boolean {
  return RESERVED_SLUGS.includes(input.trim().toLowerCase());
}

/**
 * Validates a raw slug. The input is trimmed but NOT otherwise normalized:
 * uppercase letters are rejected so two different inputs can never point at
 * the same tenant by accident.
 */
export function parseTenantSlug(input: string): TenantSlugParse {
  if (typeof input !== 'string') return { ok: false, error: 'required' };
  const slug = input.trim();
  if (!slug) return { ok: false, error: 'required' };
  if (slug.length < TENANT_SLUG_MIN) return { ok: false, error: 'tooShort' };
  if (slug.length > TENANT_SLUG_MAX) return { ok: false, error: 'tooLong' };
  if (!SLUG_RE.test(slug)) return { ok: false, error: 'invalidChars' };
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { ok: false, error: 'edgeHyphen' };
  }
  if (RESERVED_SLUGS.includes(slug)) return { ok: false, error: 'reserved' };
  return { ok: true, slug };
}

export function isValidTenantSlug(input: string): boolean {
  return parseTenantSlug(input).ok;
}
