import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';
import { basePrisma } from '@/lib/prisma-base';
import { tenantFromPath, tenantLoginPath, tenantPath } from '@/lib/tenant-path';
import {
  TENANT_ID_HEADER,
  TENANT_LOGIN_PATH_HEADER,
  TENANT_SLUG_HEADER,
} from '@/lib/tenant-request-headers';
import { isTenantServing } from '@/lib/tenant-status';
import { SUPERADMIN_PATH } from '@/lib/superadmin-constants';

/**
 * URL gate (Next 16: middleware was renamed proxy).
 *
 * A clinic is a URL: the first segment is the tenant slug. Every request that
 * resolves to a clinic gets that tenant's id/slug injected as *request* headers
 * so the scoped Prisma client, layouts, server actions and route handlers all
 * agree on the tenant. Unknown, suspended or expired tenants return a real
 * 404, as does a signed-in session that belongs to a different tenant.
 *
 * Public pages and APIs are open; the ERP tree `/[tenant]/erp/...` needs a
 * session (optimistic sniff here, signature-verified in layouts/requireRole).
 */
function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

function sessionCookieName(request: NextRequest): string {
  return request.nextUrl.protocol === 'https:'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';
}

async function sessionTenantId(request: NextRequest): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const cookieName = sessionCookieName(request);
  try {
    const token = await getToken({
      req: request,
      secret,
      salt: cookieName,
      cookieName,
      secureCookie: request.nextUrl.protocol === 'https:',
    });
    return typeof token?.tenantId === 'string' ? token.tenantId : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const lang = request.nextUrl.searchParams.get('lang');

  // The platform area is tenantless. Bypass tenant lookup/session binding and
  // blank any client-supplied internal tenant headers before the app sees them.
  const isSuperadmin =
    pathname === SUPERADMIN_PATH || pathname.startsWith(`${SUPERADMIN_PATH}/`);
  if (isSuperadmin) {
    const headers = new Headers(request.headers);
    headers.set(TENANT_ID_HEADER, '');
    headers.set(TENANT_SLUG_HEADER, '');
    headers.set(TENANT_LOGIN_PATH_HEADER, '');
    headers.set('x-locale', '');
    return NextResponse.next({ request: { headers } });
  }

  // The bare root is the platform login (which also hosts the superadmin
  // dashboard); clinics are always reached through their own URL tree.
  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone();
    url.pathname = SUPERADMIN_PATH;
    url.search = '';
    return NextResponse.redirect(url);
  }

  const slug = tenantFromPath(pathname);
  if (!slug) {
    // Root-level static files (logo, favicon, hero images) are not tenant data.
    if (!pathname.slice(1).includes('/')) return NextResponse.next();
    return notFound();
  }

  const tenant = await basePrisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true, trialEndsAt: true },
  });
  if (!tenant || !isTenantServing(tenant)) return notFound();

  // A session belongs to the clinic that issued it. Check this before the
  // login branch too: a user signed in to A gets a plain 404 at B's login
  // endpoint, never B's form (and never a redirect that reveals B).
  const sessionTenant = await sessionTenantId(request);
  if (sessionTenant && sessionTenant !== tenant.id) return notFound();

  // Open login at /<tenant>/erp/login; any secret-style suffix is not a route.
  const loginPath = tenantLoginPath(slug);
  if (pathname.startsWith(`${loginPath}/`)) return notFound();
  if (pathname === `${loginPath}/`) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  const headers = new Headers(request.headers);
  headers.set(TENANT_ID_HEADER, tenant.id);
  headers.set(TENANT_SLUG_HEADER, tenant.slug);
  // Every request needs this: getLoginPath() is used by redirects from pages,
  // actions and APIs, and must never fall back to another tenant's secret.
  headers.set(TENANT_LOGIN_PATH_HEADER, loginPath);
  // Client-supplied internal headers are never trusted. `x-locale` is derived
  // from the validated query parameter (or the tenant-scoped cookie), not from
  // an arbitrary browser header.
  headers.set('x-locale', isLocale(lang ?? undefined) ? (lang as string) : '');
  const response = NextResponse.next({ request: { headers } });
  if (isLocale(lang ?? undefined)) {
    response.cookies.set(LOCALE_COOKIE, lang as string, {
      path: tenantPath(slug),
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  // Only the ERP tree is gated optimistically, except its open login page.
  // Public pages and tenant APIs (including unauthenticated booking/feedback)
  // stay reachable.
  const erpPrefix = `${tenantPath(slug)}/erp`;
  const inErp = pathname === erpPrefix || pathname.startsWith(`${erpPrefix}/`);
  if (inErp && pathname !== loginPath && !sessionTenant) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next).*)'],
};
