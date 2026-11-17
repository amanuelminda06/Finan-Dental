/**
 * CI guard: direct use of the unscoped Prisma client is restricted to an
 * explicit allowlist. Application code must use `@/lib/prisma`, whose query
 * extension scopes every tenant-owned model to the current tenant.
 *
 * Run: npm run tenancy:check
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
let errors = 0;

function fail(message) {
  console.error(`✗ ${message}`);
  errors += 1;
}

const allowlist = new Set(
  readFileSync(join(root, 'scripts/prisma-base-allowlist.txt'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#')),
);

const SCAN_EXTENSIONS = /\.(ts|tsx|mts|cts|mjs|cjs|js|sh)$/;
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'coverage', 'playwright-report']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full, files);
    } else if (SCAN_EXTENSIONS.test(entry) && !entry.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

// A file uses the base client if it imports the singleton, imports PrismaClient
// as a runtime value, constructs it, or requires/dynamic-imports the package.
const PATTERNS = [
  [/(?:from\s+['"][^'"]*prisma-base['"])/, 'imports prisma-base'],
  [/import\s*\{[^}]*\bPrismaClient\b[^}]*\}\s*from\s*['"]@prisma\/client['"]/, 'imports PrismaClient'],
  [/\bnew\s+PrismaClient\s*\(/, 'constructs PrismaClient'],
  [/require\(\s*['"]@prisma\/client['"]\s*\)/, 'requires @prisma/client'],
  [/import\(\s*['"]@prisma\/client['"]\s*\)/, 'dynamically imports @prisma/client'],
];

const scanned = [...walk(join(root, 'src')), ...walk(join(root, 'prisma')), ...walk(join(root, 'scripts'))];
for (const file of scanned) {
  const rel = relative(root, file).split('\\').join('/');
  if (rel === 'scripts/check-prisma-allowlist.mjs') continue;
  const source = readFileSync(file, 'utf8');
  for (const [pattern, reason] of PATTERNS) {
    if (!pattern.test(source)) continue;
    if (!allowlist.has(rel)) {
      fail(`${rel} ${reason} but is not in scripts/prisma-base-allowlist.txt`);
    }
    break;
  }
}

for (const entry of allowlist) {
  if (!scanned.some((file) => relative(root, file).split('\\').join('/') === entry)) {
    fail(`allowlisted file no longer exists: ${entry}`);
  }
}

if (errors) {
  console.error(`\n${errors} base-client allowlist violation(s).`);
  process.exit(1);
}
console.log(`✓ base Prisma client use is limited to the ${allowlist.size} allowlisted files`);
