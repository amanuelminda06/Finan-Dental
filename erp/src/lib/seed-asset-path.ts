import { resolve } from 'node:path';

/**
 * Resolves a starter image shipped in `public/` to a plain filesystem path.
 *
 * `new URL('../public/x', import.meta.url)` is rewritten by Turbopack into a
 * relative URL object that `node:url.fileURLToPath` rejects in the production
 * server bundle (ERR_INVALID_ARG_TYPE). Reading the traced `public/` directory
 * directly keeps CLI seeding and the superadmin create-tenant action working
 * with the same code path.
 */
export function seedAssetPath(file: string): string {
  const segments = file.split('/');
  if (
    !file ||
    file.startsWith('/') ||
    file.includes('\\') ||
    segments.some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`Unsafe seed asset path: ${file}`);
  }
  return resolve(process.cwd(), 'public', ...segments);
}
