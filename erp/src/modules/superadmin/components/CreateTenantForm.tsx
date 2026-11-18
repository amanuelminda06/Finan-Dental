'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/lib/action';
import { createTenantAction } from '../actions';

/** Creates a trial tenant with the standard template and fixed trial logins. */
export default function CreateTenantForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createTenantAction,
    null,
  );
  const error = state && !state.ok ? state.error || 'Could not create tenant' : null;

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Create a tenant</h2>
        <p className="mt-1 text-sm text-slate-500">
          A new clinic starts in TRIAL for 30 days with a neutral template and the standard
          owner/reception/doctor logins.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="new-tenant-slug">
            URL slug *
          </label>
          <input
            className="input-field"
            id="new-tenant-slug"
            name="slug"
            placeholder="smile-dental"
            required
            disabled={pending}
          />
        </div>
        <div>
          <label className="label" htmlFor="new-tenant-name">
            Clinic name *
          </label>
          <input
            className="input-field"
            id="new-tenant-name"
            name="name"
            placeholder="Smile Dental"
            required
            disabled={pending}
          />
        </div>
        <div>
          <label className="label" htmlFor="new-tenant-email">
            Owner email *
          </label>
          <input
            className="input-field"
            id="new-tenant-email"
            name="ownerEmail"
            type="email"
            placeholder="owner@example.com"
            required
            disabled={pending}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="demoData"
          value="true"
          className="h-4 w-4 rounded border-slate-300"
          disabled={pending}
        />
        Include demo patients and sales
      </label>
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create tenant'}
        </button>
      </div>
    </form>
  );
}
