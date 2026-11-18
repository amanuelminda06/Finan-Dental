import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SUPERADMIN_COOKIE, SUPERADMIN_PATH, SUPERADMIN_USERNAME } from './superadmin-constants';

/**
 * Platform login. This is deliberately separate from tenant Auth.js: a clinic
 * session is tenant-bound, while a superadmin session must work at every URL
 * and carry no tenant id at all. The cookie is signed with AUTH_SECRET and has
 * an independent name/path, so it can never be mistaken for a tenant session.
 */
const SUPERADMIN_PASSWORD = '2906';
const SESSION_MAX_AGE = 12 * 60 * 60;

export type SuperadminSession = { username: string };

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET is required for superadmin sessions');
  return value;
}

function constantEqual(left: string, right: string): boolean {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function verifySuperadminCredentials(username: unknown, password: unknown): boolean {
  const user = typeof username === 'string' ? username.trim() : '';
  const pass = typeof password === 'string' ? password : '';
  return constantEqual(user, SUPERADMIN_USERNAME) && constantEqual(pass, SUPERADMIN_PASSWORD);
}

/** Payload is `username.expiresAt`, signed separately. Pure apart from AUTH_SECRET. */
export function encodeSuperadminToken(username: string, expiresAt: number): string {
  const payload = `${username}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function decodeSuperadminToken(token: string | undefined): SuperadminSession | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [username, expires, signature] = parts;
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
  if (!constantEqual(signature, sign(`${username}.${expires}`))) return null;
  if (!constantEqual(username, SUPERADMIN_USERNAME)) return null;
  return { username: SUPERADMIN_USERNAME };
}

export async function createSuperadminSession(): Promise<void> {
  const token = encodeSuperadminToken(SUPERADMIN_USERNAME, Date.now() + SESSION_MAX_AGE * 1000);
  (await cookies()).set(SUPERADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSuperadminSession(): Promise<SuperadminSession | null> {
  return decodeSuperadminToken((await cookies()).get(SUPERADMIN_COOKIE)?.value);
}

export async function clearSuperadminSession(): Promise<void> {
  (await cookies()).delete(SUPERADMIN_COOKIE);
}

export async function requireSuperadmin(): Promise<SuperadminSession> {
  const session = await getSuperadminSession();
  if (!session) redirect(SUPERADMIN_PATH);
  return session;
}
