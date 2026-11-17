import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Explicit tenant scope for code that has no request session (seeds, jobs,
 * integration tests). Request code leaves this unset so the Prisma extension
 * resolves the tenant from the session JWT.
 */
const tenantStorage = new AsyncLocalStorage<string>();

/**
 * Run an async callback with an explicit tenant. Prisma queries are lazy, so
 * the callback must be awaited inside the storage scope.
 */
export async function runWithTenant<T>(tenantId: string, fn: () => T | Promise<T>): Promise<T> {
  return tenantStorage.run(tenantId, async () => await fn());
}

export function getExplicitTenantId(): string | undefined {
  return tenantStorage.getStore();
}
