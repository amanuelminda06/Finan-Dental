import { getSuperadminSession } from '@/lib/superadmin-auth';
import { listTenants } from '@/modules/superadmin/service';
import SuperadminDashboard from '@/modules/superadmin/components/SuperadminDashboard';
import SuperadminLogin from '@/modules/superadmin/components/SuperadminLogin';

/** Platform login when signed out; tenant management dashboard when signed in. */
export default async function SuperadminPage() {
  const session = await getSuperadminSession();
  if (!session) return <SuperadminLogin />;

  const tenants = await listTenants();
  return <SuperadminDashboard tenants={tenants} />;
}
