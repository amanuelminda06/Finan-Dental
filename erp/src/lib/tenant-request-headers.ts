/**
 * Internal request headers used to carry the URL-resolved tenant from the
 * proxy to pages, layouts and route handlers. Shared with `proxy.ts` (which
 * must not import async server-only APIs). These are set on the *request*, so
 * they cannot be spoofed by a browser header of the same name — the proxy
 * overwrites them after resolving the slug against the database.
 */
export const TENANT_ID_HEADER = 'x-finan-tenant-id';
export const TENANT_SLUG_HEADER = 'x-finan-tenant-slug';
export const TENANT_LOGIN_PATH_HEADER = 'x-finan-login-path';
