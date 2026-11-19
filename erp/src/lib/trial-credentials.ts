/**
 * Fixed trial logins for every clinic.
 *
 * `tenant:create` and `seed:platform` create these three accounts with no
 * forced password change. They are deliberately short and bypass the
 * normal password-strength rules: they exist so an evaluator can sign in
 * immediately. `tenant:activate` flips a clinic live; password changes remain
 * voluntary from the user menu.
 *
 * The login field accepts either the short name below or a full email. Short
 * names are resolved to a *role within the clinic in the URL*, never globally.
 */

export type TrialRole = 'OWNER' | 'RECEPTION' | 'STAFF';

export const TRIAL_LOGINS: ReadonlyArray<{
  role: TrialRole;
  shortName: string;
  password: string;
  name: string;
}> = [
  { role: 'OWNER', shortName: 'owner', password: 'owner123', name: 'Clinic Owner' },
  { role: 'RECEPTION', shortName: 'reception', password: 'reception123', name: 'Reception Desk' },
  { role: 'STAFF', shortName: 'doctor', password: 'doctor123', name: 'Clinic Dentist' },
];

export function trialLogin(role: TrialRole) {
  const login = TRIAL_LOGINS.find((entry) => entry.role === role);
  if (!login) throw new Error(`No trial login defined for role ${role}`);
  return login;
}

/** Map a short login name to its role; full emails return null. */
export function resolveTrialRole(identifier: string): TrialRole | null {
  const value = identifier.trim().toLowerCase();
  return TRIAL_LOGINS.find((entry) => entry.shortName === value)?.role ?? null;
}

/** Deterministic tenant-scoped email used when provisioning a trial account. */
export function trialEmail(tenantSlug: string, role: TrialRole): string {
  return `${trialLogin(role).shortName}@${tenantSlug}.test`;
}
