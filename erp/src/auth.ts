import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { env } from '@/env';
import { getRequestLoginPath } from '@/lib/tenant-request';
import { TENANT_ID_HEADER } from '@/lib/tenant-request-headers';
import { tenantLoginPath } from '@/lib/tenant-path';
import { verifyCredentials } from '@/modules/auth';

/**
 * The login URL belongs to the tenant in the request (its own `loginSecret`).
 * The proxy injects it as a request header, so no global secret path is needed.
 * Outside a request (scripts/tests) the seeded default tenant is used.
 */
export async function getLoginPath(): Promise<string> {
  try {
    return await getRequestLoginPath();
  } catch {
    return tenantLoginPath(env.DEFAULT_TENANT_SLUG, env.LOGIN_SECRET_PATH);
  }
}

/** 12-hour session (spec). */
const SESSION_MAX_AGE = 12 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
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
});
