import { notFound } from 'next/navigation';
import LoginForm from '@/modules/auth/components/LoginForm';
import { getRequestLoginPath } from '@/lib/tenant-request';
import { tenantLoginPath } from '@/lib/tenant-path';

/**
 * The only entry point — `/[tenant]/login/<Tenant.loginSecret>`.
 * The proxy already 404s other login paths; this server-side check makes sure
 * the URL never renders unless the secret belongs to this clinic.
 */
export default async function LoginPage({
  params,
}: {
  params: Promise<{ tenant: string; secret: string }>;
}) {
  const [{ tenant: slug, secret }, expectedPath] = await Promise.all([
    params,
    getRequestLoginPath(),
  ]);
  if (tenantLoginPath(slug, secret) !== expectedPath) notFound();

  return <LoginForm />;
}
