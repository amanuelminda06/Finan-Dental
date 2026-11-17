# Tenancy design and audit

Last updated: 2026-11-17 (branch `multitenant`).

## Threat model

A signed-in user of tenant A must never be able to read, write, update, delete,
search, export, upload under, or audit the data of tenant B — including by
supplying a foreign id in a form, a nested write, a transaction, or a raw SQL
call. There is one Postgres database; isolation is enforced in the data layer,
not by separate schemas or connections.

## How scoping works

- `src/lib/prisma-base.ts` holds the single unscoped `PrismaClient` (`basePrisma`).
  Application code never imports it directly.
- `src/lib/tenant-prisma.ts` wraps that client with a `$extends()` query
  extension and exports the scoped singleton from `src/lib/prisma.ts`.
- The set of tenant-owned models is **derived from the generated schema**, not
  hand-maintained: every DMMF model with a `tenantId` field is scoped, and every
  other model (notably `Tenant`) is left alone. Currently 28 models.
- For every scoped model and every read/write operation (`findMany`,
  `findUnique`, `create`, `update`, `updateMany`, `delete`, `deleteMany`,
  `upsert`, `aggregate`, `groupBy`, `count`, nested writes, and interactive
  transactions), the extension injects `tenantId` into `where`/`data` and
  validates any explicit tenant value. A caller-supplied `tenantId` (or tenant
  relation) that disagrees with the resolved tenant throws `TenantMismatchError`.
- Nested creates use `tenant: { connect: { id } }` where a relation exists and
  the scalar `tenantId` otherwise; update payloads are left untouched (the
  scoped `where` is sufficient).
- `findRaw`, `aggregateRaw` and `runCommandRaw` are blocked by the extension.

### Tenant resolution order

`src/lib/tenant-scope.ts` + `src/lib/tenant-context.ts`:

1. `runWithTenant(tenantId, fn)` — an explicit `AsyncLocalStorage` scope used by
   jobs, seeds and tests. This is authoritative for **both** the Prisma
   extension and `getTenantId()`/`getDefaultTenantId()`, so cron, storage,
   public feeds, settings and audit stay coherent with the scoped client.
2. The signed-in session's `user.tenantId` (baked into the JWT at sign-in).
3. `DEFAULT_TENANT_SLUG` for anonymous flows (public booking/feedback, doctors
   feed, cron) until host-based tenancy lands.

`runWithTenant()` is async and must be awaited so lazy Prisma promises execute
inside the scope.

### What the extension does NOT cover

- **Scalar FK ids** from form data (e.g. `staffId`, `serviceId`,
  `createdFromAppointmentId`) are plain strings, not Prisma relations, so the
  extension cannot validate them. Every such call site now performs a scoped
  `findUnique` first: a foreign id returns `null` and the action rejects it
  (`src/modules/users/actions.ts`, `src/modules/appointments/actions.ts`,
  `src/modules/hr/actions.ts`). Verified by an action-level isolation test.
- **Raw SQL** bypasses the extension and must filter on `tenantId` explicitly
  (see inventory below).
- **The base client** bypasses the extension and is restricted by an allowlist
  enforced in CI (see below).

## Raw SQL inventory

Every raw statement in the repository is listed here. `pg` is the non-Prisma
Postgres driver used by infrastructure/QA scripts.

| # | File:line | API | Statement / purpose | Tenant filter |
|---|-----------|-----|---------------------|---------------|
| 1 | `src/modules/sales/receipt.ts:53` | `$queryRaw` | `SELECT MAX(...receiptNumber...) FROM "Sale" WHERE receiptNumber LIKE year AND "tenantId" = $tenantId` | **Yes** — explicit `"tenantId" = ${tenantId}` |
| 2 | `src/modules/sales/receipt.ts:67` | `$queryRaw` | `INSERT INTO "ReceiptCounter" ... ON CONFLICT ("tenantId","year") DO UPDATE ... RETURNING "lastNumber"` | **Yes** — keyed by tenant; conflict target `("tenantId","year")` |
| 3 | `src/modules/sales/receipt.ts:80` | `$executeRaw` | `UPDATE "ReceiptCounter" SET "lastNumber" = $next WHERE "year" = $year AND "tenantId" = $tenantId` | **Yes** — explicit `"tenantId" = ${tenantId}` |
| 4 | `src/app/(app)/patients/[id]/page.tsx:53` | `$executeRaw` | `SELECT pg_advisory_xact_lock(hashtext('view:<tenantId>:<patientId>:<userId>'))` | **Yes** — lock key namespaced by tenant |
| 5 | `prisma/seed.ts:199` | `$executeRawUnsafe` | `CREATE INDEX IF NOT EXISTS "Patient_tenantId_birthday_md_idx" ... ("tenantId", EXTRACT(...birthDate...))` | **Yes** — index leads with `tenantId`; DDL, no row data |
| 6 | `src/lib/tenant-uniqueness.test.ts:274` | `$queryRaw` | `SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='Patient' AND indexname=...` | **N/A** — metadata read asserting the index definition starts with `"tenantId"`; no business rows |
| 7 | `scripts/tmp-null-check.mts:6` | `$queryRawUnsafe` | `SELECT count(*) FROM "<t>" WHERE "tenantId" IS NULL` over all 28 tenant-owned tables | **Intentional global audit** — one-time migration check that no rows have a NULL tenant; no cross-tenant data returned, only per-table counts |
| 8 | `scripts/tmp-backfill.mts:7` | `$executeRawUnsafe` | `UPDATE "<t>" SET "tenantId" = $tenantId WHERE "tenantId" IS NULL` over all 28 tables | **Intentional global repair** — one-time backfill that assigns leftover NULL rows to a single known tenant; only touches rows with no tenant at all |
| 9 | `scripts/db.mjs:92,99` | `pg client.query` | `SELECT 1 FROM pg_database WHERE datname=$1`; `CREATE DATABASE "<name>"` | **N/A** — embedded-Postgres instance bootstrap; operates above the tenant level |
| 10 | `scripts/qa/phase1-test.mjs:46,50,122,134,163,188` | `pg client.query` | Login-lockout / audit QA assertions by email and entity id against a dedicated `vision_erp_test` database | **N/A in production** — QA-only test harness; not application code and not deployed |

Statements 1–5 are tenant-safe by construction. Statement 6 is a test-only
metadata assertion. Statements 7–10 are intentional global/migration/infra
scripts, are not used by the running application, and are documented here
rather than "fixed" because their purpose is precisely to operate across all
tenants (backfill NULLs, bootstrap the instance, run QA).

## Base-client allowlist

`scripts/check-prisma-allowlist.mjs` (run via `npm run tenancy:check`, wired into
`.github/workflows/tenancy.yml`) fails CI if any file outside
`scripts/prisma-base-allowlist.txt` imports `prisma-base`, imports/constructs
`PrismaClient`, or requires/dynamic-imports `@prisma/client`. The allowlist is
17 files, grouped as:

- **Library/core** — `prisma-base.ts` (the client itself), `tenant-prisma.ts`
  (the extension), and the three tenant test files that deliberately use the
  unscoped client to set up/tear down tenants and assert raw state.
- **Seeds** — `prisma/seed*.ts`, which create tenants and need the unscoped
  client to bootstrap data across tenants.
- **Maintenance/QA scripts** — client export, login-secret setter, QA reset/change
  scripts, and the two global backfill/audit scripts above.

Any new file that needs the unscoped client must be added to the allowlist with
a rationale here. Application features must use the scoped `@/lib/prisma`.

## Verification

- `npm run tenancy:check` — allowlist guard (also in CI).
- `npm run typecheck` — no type errors.
- `npx vitest run src/lib/tenant-prisma.test.ts src/lib/tenant-isolation.test.ts`
  — 14 tests deriving the model list from the schema, checking nested writes,
  transactions, mismatches, and two-temporary-tenant isolation across lists,
  detail-by-id, updates/deletes, export, search, uploads, public feeds, cron and
  scalar-FK server actions. These tests self-guard to the local embedded Postgres
  at `127.0.0.1:5433/vision_erp` and refuse any other database.

## Known limitations

- Anonymous/public flows are pinned to `DEFAULT_TENANT_SLUG`; there is no
  host-based tenant selection yet. Multi-tenant public traffic (e.g. two clinic
  domains served by one deployment) is not supported until that lands.
- Cron `runMessageJobs` operates on one tenant per invocation; multi-tenant job
  fan-out must call `runWithTenant()` per tenant.
