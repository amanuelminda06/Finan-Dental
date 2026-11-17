import { notFound } from 'next/navigation';
import { getRequestTenantId } from './tenant-request';

/**
 * A session is bound to the clinic it was issued for. If it is presented at a
 * different clinic's URL, pretend the clinic does not exist (404) so no tenant
 * membership or user data can be inferred from the response.
 *
 * Outside a request (unit tests, scripts) there is no URL to compare against,
 * so the check is a no-op.
 */
export async function assertSessionTenant(sessionTenantId: string | undefined): Promise<void> {
  const requestTenantId = await getRequestTenantId();
  if (requestTenantId && sessionTenantId !== requestTenantId) notFound();
}
