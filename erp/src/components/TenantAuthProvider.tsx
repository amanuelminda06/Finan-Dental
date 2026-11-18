'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { tenantApiPath } from '@/lib/tenant-path';

/**
 * Auth.js client helpers (`signIn`, `getSession`, `signOut`) default to the
 * root `/api/auth`. Every clinic owns its own API tree, so the client basePath
 * must be set from the URL tenant before any of those helpers run — including
 * on the login page, which has no other SessionProvider ancestor.
 */
export default function TenantAuthProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  return <SessionProvider basePath={tenantApiPath(slug, '/auth')}>{children}</SessionProvider>;
}
