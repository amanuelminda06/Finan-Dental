import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { headers as nextHeaders } from 'next/headers';
import type { NextRequest } from 'next/server';
import { env } from '@/env';
import { getRequestLoginPath, hasRequestContext } from '@/lib/tenant-request';
import { TENANT_ID_HEADER, TENANT_SLUG_HEADER } from '@/lib/tenant-request-headers';
import { tenantApiPath, tenantLoginPath } from '@/lib/tenant-path';
import { parseTenantSlug } from '@/lib/tenant-slug';
import { verifyCredentials } from '@/modules/auth';

/**
 * The login URL belongs to the tenant in the request (its own `loginSecret`).
 * The proxy injects it as a request header, so no global secret path is needed.
 * Outside a request (scripts/tests) the seeded default tenant is used.
 */
export async function getLoginPath(): Promise<string> {
  // Inside a request the proxy has already resolved the clinic from the URL:
  // a missing header fails closed (404) instead of leaking the default tenant's
  // secret link. The default is only for scripts/tests outside a request.
  if (await hasRequestContext()) return getRequestLoginPath();
  return tenantLoginPath(env.DEFAULT_TENANT_SLUG, env.LOGIN_SECRET_PATH);
}

/** 12-hour session (spec). */
const SESSION_MAX_AGE = 12 * 60 * 60;

type HeaderBag = { get(name: string): string | null };

/** The proxy's request headers in a route handler, or an RSC's headers. */
async function requestHeaders(request: NextRequest | undefined): Promise<HeaderBag | null> {
  if (request) return request.headers;
  try {
    return await nextHeaders();
  } catch {
    // signIn/signOut called outside a request (scripts, tests).
    return null;
  }
}

/**
 * The clinic this auth request belongs to. The proxy injects the slug on every
 * tenant request; fall back to the URL (and then the seeded default) for the
 * RSC/helper paths that have no NextRequest.
 */
async function requestTenantSlug(request: NextRequest | undefined): Promise<string> {
  const headers = await requestHeaders(request);
  const fromProxy = headers?.get(TENANT_SLUG_HEADER);
  if (fromProxy) return fromProxy;
  const first = (request?.nextUrl?.pathname ?? '').replace(/^\/+/, '').split('/')[0] ?? '';
  const parsed = first ? parseTenantSlug(first) : null;
  if (parsed?.ok) return parsed.slug;
  return env.DEFAULT_TENANT_SLUG;
}

function authConfig(basePath: string): NextAuthConfig {
  return {
    // Auth.js parses the action from `pathname` relative to `basePath`. Each
    // clinic owns `/<tenant>/api/auth`, so the path is resolved per request (in
    // the config factory below) instead of using the root default.
    basePath,
    session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE },
    // trustHost is required on Vercel because the request host is derived from
    // forwarded headers; AUTH_URL is set explicitly to avoid host-header spoofing.
    trustHost: true,
    // Real sign-in redirects use getLoginPath() (per tenant). The proxy handles
    // unauthenticated ERP pages; this is only a last-resort NextAuth fallback.
    pages: { signIn: '/' },
    cookies: {
      sessionToken: {
        options: {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: SESSION_MAX_AGE,
        },
      },
    },
    providers: [
      Credentials({
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        // The proxy resolved the tenant from the login URL and put its id on the
        // request. Never derive it from user-supplied credentials.
        authorize: async (credentials, request) => {
          const tenantId = request.headers.get(TENANT_ID_HEADER);
          if (!tenantId) return null;
          return verifyCredentials(credentials, tenantId);
        },
      }),
    ],
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          token.role = user.role;
          token.mustChangePassword = user.mustChangePassword;
          token.tenantId = user.tenantId;
          token.tenantSlug = user.tenantSlug;
        }
        return token;
      },
      session({ session, token }) {
        session.user.id = token.sub ?? '';
        if (token.role) session.user.role = token.role;
        if (typeof token.mustChangePassword === 'boolean') {
          session.user.mustChangePassword = token.mustChangePassword;
        }
        if (token.tenantId) session.user.tenantId = token.tenantId;
        if (token.tenantSlug) session.user.tenantSlug = token.tenantSlug;
        return session;
      },
    },
  };
}

/**
 * Auth.js v5 accepts a config factory and calls it for every HTTP request and
 * RSC read, so `basePath` — and therefore every auth URL and action parse — is
 * scoped to the clinic in the URL. Without this, Auth.js defaults to the root
 * `/api/auth`, which rejects `/<tenant>/api/auth/*` with "Bad request." and
 * sends the client back to a tenantless route.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(async (request) =>
  authConfig(tenantApiPath(await requestTenantSlug(request), '/auth')),
);
