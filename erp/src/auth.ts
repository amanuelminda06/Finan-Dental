import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { env } from '@/env';
import { getDefaultTenantId } from '@/lib/tenant-context';
import { verifyCredentials } from '@/modules/auth';

export const loginPath = `/login/${env.LOGIN_SECRET_PATH}`;

/** 12-hour session (spec). */
const SESSION_MAX_AGE = 12 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE },
  // trustHost is required on Vercel because the request host is derived from
  // forwarded headers; AUTH_URL is set explicitly to avoid host-header spoofing.
  trustHost: true,
  pages: { signIn: loginPath },
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
      // Login has no session yet: scope credentials to the configured default
      // tenant explicitly instead of deriving tenant from user input.
      authorize: async (credentials) => verifyCredentials(credentials, await getDefaultTenantId()),
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
