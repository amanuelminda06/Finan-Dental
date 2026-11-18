import { SUPERADMIN_PATH } from '@/lib/superadmin-constants';
import { superadminLogoutAction } from '../actions';
import type { SuperadminTenant } from '../service';
import CreateTenantForm from './CreateTenantForm';

function statusClass(status: SuperadminTenant['status']): string {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700';
  if (status === 'TRIAL') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-200 text-slate-600';
}

/** Signed-in platform home: tenant inventory plus creation. */
export default function SuperadminDashboard({ tenants }: { tenants: SuperadminTenant[] }) {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Platform</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Superadmin dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage tenant identity, website content, branding and ERP settings.
          </p>
        </div>
        <form action={superadminLogoutAction}>
          <button type="submit" className="btn-secondary">
            Sign out
          </button>
        </form>
      </header>

      <CreateTenantForm />

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Tenants</h2>
          <p className="mt-1 text-sm text-slate-500">
            {tenants.length} clinic{tenants.length === 1 ? '' : 's'} provisioned on this platform.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Clinic</th>
                <th className="px-6 py-3">URL</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Trial ends</th>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {tenant.clinicName}
                    {tenant.protected ? (
                      <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        protected
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-slate-600">/{tenant.slug}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${statusClass(tenant.status)}`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {tenant.trialEndsAt ? tenant.trialEndsAt.slice(0, 10) : '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {tenant.counts.users} users · {tenant.counts.patients} patients
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a
                      className="font-medium text-slate-700 underline underline-offset-2"
                      href={`${SUPERADMIN_PATH}/tenants/${tenant.slug}`}
                    >
                      Manage
                    </a>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-slate-500" colSpan={6}>
                    No tenants yet. Create one above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
