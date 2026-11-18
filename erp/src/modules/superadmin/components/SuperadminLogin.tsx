'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/lib/action';
import { superadminLoginAction } from '../actions';

/** Tenant-independent platform login. Uses its own session, never Auth.js. */
export default function SuperadminLogin() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    superadminLoginAction,
    null,
  );
  const error = state && !state.ok ? state.error || 'Sign-in failed' : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="card p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Platform</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Superadmin sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage every clinic&apos;s website, branding and ERP from here.
          </p>

          <form action={formAction} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="superadmin-username">
                Username
              </label>
              <input
                className="input-field"
                id="superadmin-username"
                name="username"
                type="text"
                autoCapitalize="none"
                autoComplete="username"
                autoFocus
                required
                disabled={pending}
                aria-invalid={!!error}
              />
            </div>
            <div>
              <label className="label" htmlFor="superadmin-password">
                Password
              </label>
              <input
                className="input-field"
                id="superadmin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={pending}
                aria-invalid={!!error}
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn-primary w-full" disabled={pending}>
              {pending ? 'Signing in…' : 'Platform sign in'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Clinic logins live at <code>/&lt;tenant&gt;/erp/login</code>.
        </p>
      </div>
    </main>
  );
}
