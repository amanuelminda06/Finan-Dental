import { redirect } from 'next/navigation';
import { env } from '@/env';
import { tenantPath } from '@/lib/tenant-path';

/** Fallback for visitors that bypass the proxy: every clinic lives under its slug. */
export default function RootPage() {
  redirect(tenantPath(env.DEFAULT_TENANT_SLUG));
}
