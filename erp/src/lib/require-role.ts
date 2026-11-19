import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import type { Session } from 'next-auth';
import { auth, getLoginPath } from '@/auth';
import { assertSessionTenant } from './session-tenant';
import { tenantServerHref } from './tenant-server-path';
import { hasRole } from './roles';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type AuthErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'PASSWORD_CHANGE_REQUIRED';

export class AuthorizationError extends Error {
  readonly code: AuthErrorCode;
  constructor(code: AuthErrorCode) {
    super(code);
    this.name = 'AuthorizationError';
    this.code = code;
  }
}

function toSessionUser(user: NonNullable<Session>['user']): SessionUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? user.email ?? '',
    role: user.role,
  };
}

/** Any authenticated user (used by the voluntary /change-password page). */
export async function requireAuth(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect(await getLoginPath());
  await assertSessionTenant(user.tenantId);
  return toSessionUser(user);
}

/**
 * THE single authorization helper (rule 2). Every server action and protected
 * page must call this with its allowed roles.
 *
 * - No session               → redirect to this clinic's open login page.
 * - Session from another clinic → 404 (see assertSessionTenant).
 * - Wrong role               → throws FORBIDDEN.
 * - `redirect()` errors are never converted — they are not AuthorizationError.
 */
export async function requireRole(allowed: Role[]): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect(await getLoginPath());
  await assertSessionTenant(user.tenantId);
  if (!hasRole(user.role, allowed)) throw new AuthorizationError('FORBIDDEN');
  return toSessionUser(user);
}

/**
 * Page variant: turns a wrong-role AuthorizationError into a friendly 403
 * redirect. Password changes are voluntary in the free trial, so there is no
 * change-password gate here.
 */
export async function requirePageRole(allowed: Role[]): Promise<SessionUser> {
  try {
    return await requireRole(allowed);
  } catch (err) {
    if (err instanceof AuthorizationError) redirect(await tenantServerHref('/403'));
    throw err;
  }
}
