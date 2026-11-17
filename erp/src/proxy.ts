import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { env } from '@/env';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';
import { basePrisma } from '@/lib/prisma-base';
import { tenantFromPath, tenantLoginPath, tenantPath } from '@/lib/tenant-path';
import {
  TENANT_ID_HEADER,
  TENANT_LOGIN_PATH_HEADER,
  TENANT_SLUG_HEADER,
} from '@/lib/tenant-request-headers';
import { isTenantServing } from '@/lib/tenant-status';

/**
 * URL gate (Next 16: middleware was renamed proxy).
 *
 * A clinic is a URL: the first segment is the tenant slug. Every request that
 * resolves to a clinic gets that tenant's id/slug injected as *request* headers
 * so the scoped Prisma client, layouts, server actions and route handlers all
 * agree on the tenant. Unknown, suspended or expired tenants return a real
 * 404, as does a signed-in session that belongs to a different tenant.
 *
 * Public pages and APIs are open; the ERP tree `/[tenant]/app/...` needs a
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

  // The bare root is the only tenantless entry point: it sends visitors to the
  // configured default clinic, which then owns all subsequent URLs.
  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone();
    url.pathname = tenantPath(env.DEFAULT_TENANT_SLUG);
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
    select: { id: true, slug: true, status: true, trialEndsAt: true, loginSecret: true },
  });
  if (!tenant || !isTenantServing(tenant)) return notFound();

  // Login is reachable only at this clinic's own secret path.
  const loginPath = tenantLoginPath(slug, tenant.loginSecret);
  if (pathname === `${loginPath}/`) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }
  if (pathname === loginPath) {
    const headers = new Headers(request.headers);
    headers.set(TENANT_ID_HEADER, tenant.id);
    headers.set(TENANT_SLUG_HEADER, tenant.slug);
    headers.set(TENANT_LOGIN_PATH_HEADER, loginPath);
    if (isLocale(lang ?? undefined)) headers.set('x-locale', lang as string);
    const response = NextResponse.next({ request: { headers } });
    if (isLocale(lang ?? undefined)) {
      response.cookies.set(LOCALE_COOKIE, lang as string, {
        path: tenantPath(slug),
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
    }
    return response;
  }
  if (pathname.startsWith(`${tenantPath(slug)}/login`)) return notFound();

  const sessionTenant = await sessionTenantId(request);
  if (sessionTenant && sessionTenant !== tenant.id) return notFound();

  const headers = new Headers(request.headers);
  headers.set(TENANT_ID_HEADER, tenant.id);
  headers.set(TENANT_SLUG_HEADER, tenant.slug);
  if (isLocale(lang ?? undefined)) headers.set('x-locale', lang as string);
  const response = NextResponse.next({ request: { headers } });
  if (isLocale(lang ?? undefined)) {
    response.cookies.set(LOCALE_COOKIE, lang as string, {
      path: tenantPath(slug),
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  // Only the ERP tree is gated optimistically; public pages and tenant APIs
  // (including unauthenticated booking/feedback) stay reachable.
  const appPrefix = `${tenantPath(slug)}/app`;
  if ((pathname === appPrefix || pathname.startsWith(`${appPrefix}/`)) && !sessionTenant) {
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
