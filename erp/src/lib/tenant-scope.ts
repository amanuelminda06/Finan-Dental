import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Explicit tenant scope for code with no URL request (seeds, jobs, tests).
 * Request code leaves this unset so the Prisma extension resolves the tenant
 * from the proxy-injected URL headers, never from a session or a default.
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
