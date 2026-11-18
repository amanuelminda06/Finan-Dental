# Tenancy design and audit

Last updated: 2026-11-17 (branch `multitenant`). One Postgres database, many
clinics, one URL tree per clinic.

## Threat model

A signed-in user of tenant A must never be able to read, write, update, delete,
search, export, upload under, or audit the data of tenant B — including by
supplying a foreign id in a form, a nested write, a transaction, or a raw SQL
call. Isolation is enforced in the data layer, not by separate schemas or
connections.

With tenancy in the URL there is a second boundary: a request that *claims* to
be for clinic B (by URL) but carries a session, secret or cookie belonging to
clinic A must get a plain **404 everywhere** — pages, APIs, uploads, SEO files
and the login endpoint. It must never get a redirect, a 403 or a response that
reveals B exists. Unknown, suspended and expired- trial tenants are treated the
same way.

## URL layout and request identity

Every clinic owns a URL prefix. The bare root is the only tenantless route.

| Area | URL | Notes |
| --- | --- | --- |
| Default entry | `/` → `/<tenant>` | 307 redirect to `DEFAULT_TENANT_SLUG` |
| Public site | `/<tenant>/...` | marketing, booking, `sitemap.xml`, `robots.txt` |
| ERP | `/<tenant>/app/...` | dashboard, patients, sales, settings, … |
| APIs | `/<tenant>/api/...` | auth, exports, uploads, public feeds, cron |
| Secret login | `/<tenant>/login/<secret>` | `secret` is that tenant's `Tenant.loginSecret` |
| Shared assets | `/<tenant>/static/...` | rewritten to root `public/` files |

`src/proxy.ts` runs on every route except `_next` (matcher `/((?!_next).*)`):

1. `/` gets a 307 redirect to the default tenant's public home.
2. The slug is the first path segment. A missing/invalid slug is allowed only
   for root-level static files; anything else 404s.
3. The slug is looked up with the **unscoped** client (`basePrisma`) and checked
   with `isTenantServing()` (status `TRIAL`/`ACTIVE`, unexpired trial). Missing
   or not-serving → 404.
4. The NextAuth JWT is decoded with `next-auth/jwt` using the tenant-specific
   cookie name/secret on **every** tenant request, including the login endpoint:
   a session whose `tenantId` differs from the URL tenant → 404. APIs and public
   pages are not otherwise gated here; their own handlers enforce roles.
5. The proxy overwrites (never trusts incoming) three internal headers:
   `x-finan-tenant-id`, `x-finan-tenant-slug`, `x-finan-login-path`. Browser-
   supplied values are discarded. Every tenant request gets the login-path
   header, not just the login page: `getLoginPath()` is used by redirects from
   pages, actions and APIs, so a missing header must fail closed with 404 rather
   than substitute the default tenant's secret.
6. `?lang=en|am` is forwarded as `x-locale` and persisted in a cookie scoped to
   `/<tenant>`, so language preferences do not leak across clinics.

`src/lib/tenant-path.ts` is the single place that builds tenant URLs
(`tenantPath`, `tenantAppPath`, `tenantApiPath`, `tenantAssetPath`,
`tenantLoginPath`, `tenantHref`). Client components keep root-relative literals
and go through `TenantLink` / `useTenantRouter` / `useTenantHref` /
`useTenantHrefIn` (`src/components/tenant-navigation.tsx`) and the image wrappers
`TenantImage` / `TenantImg`, so no link, redirect, fetch, image URL, form action,
sitemap, robots or opengraph URL is hardcoded to the root. Stored image URLs are
public assets even in the ERP, so the wrappers resolve them with an explicit
`area: 'public'` instead of inheriting the caller's `app` area.

Next 16 only emits `robots.ts` metadata from the root of `app`, so the nested
`app/[tenant]/robots.ts` is shared config rather than a route. It is serialized
by `app/[tenant]/robots.txt/route.ts` at `/<tenant>/robots.txt`; both the config
and the route handler are covered by unit and e2e tests.

## How scoping works (data layer)

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

`src/lib/tenant-scope.ts`, `src/lib/tenant-context.ts` and
`src/lib/tenant-request.ts`:

1. `runWithTenant(tenantId, fn)` — an explicit `AsyncLocalStorage` scope used by
   cron fan-out, seeds and tests. Authoritative for both the Prisma extension
   and `getTenantId()`.
2. **In a request**, the tenant comes exclusively from the proxy's injected URL
   headers via `getRequestTenant()` / `getRequestTenantId()`. There is
   deliberately **no session and no `DEFAULT_TENANT_SLUG` fallback** in a
   request flow: a signed-in session may not silently reach another clinic's
   data. A missing header means the request bypassed the proxy and must not
   touch tenant data.
3. **Outside a request** (scripts, unit tests) `DEFAULT_TENANT_SLUG` still
   selects the seeded clinic. Server-side URL helpers use `getLoginPath()`,
   which reads the proxy's login-path header in a request and falls back to the
   default tenant only outside one.

`runWithTenant()` is async and must be awaited so lazy Prisma promises execute
inside the scope. React child rendering does not reliably inherit the ALS scope;
request handlers therefore rely on the proxy headers and use
`withRequestTenant()` where an explicit scope is needed.

### Session, secret and per-tenant state

- `verifyCredentials()` looks the user up by **URL tenant** (the login page
  passes the `tenant` route param) and returns a JWT carrying `tenantId` and
  `tenantSlug`. Credentials from A cannot sign in at B.
- The secret login URL is read from `Tenant.loginSecret`. The proxy injects it
  as a header; `getLoginPath()` uses that header and fails closed (404) inside
  a request rather than substituting the default tenant. A's secret at B's URL
  404s.
- Auth.js defaults to the root `/api/auth` on **both** sides. `TenantAuthProvider`
  in the tenant layout sets `SessionProvider`'s client `basePath` to
  `/<tenant>/api/auth`, so `signIn`, `getSession` and `signOut` from the login,
  change-password and ERP screens all call **this clinic's** API tree. On the
  server, `auth.ts` uses Auth.js v5's per-request config factory to set the same
  `basePath` from the proxy's tenant header; without it Auth.js cannot parse the
  action in `/<tenant>/api/auth/*` and answers "Bad request." (400).
- `assertSessionTenant()` (`src/lib/session-tenant.ts`) is called by
  `requireAuth()` / `requireRole()` and additionally by layouts, the uploads
  route and the message-count API. A session with no or a foreign tenant 404s.
- Rate-limit keys are `tenantRateLimitKey(scope, tenantId, ip)` — login,
  public booking and public feedback budgets are independent per clinic.
- The locale cookie is written at `/<tenant>` by both the proxy and the
  client-side locale switchers.

### Cron fan-out

`POST /<tenant>/api/jobs/messages` is reachable at any serving tenant URL but is
a **platform** endpoint: it fans out over every TRIAL/ACTIVE tenant returned by
`cronTenantWhere()` using `basePrisma`, then runs `runMessageJobs()` inside
`runWithTenant(tenant.id, …)` for each. The response is
`{ ok, tenants, results: [{ tenant, summary }] }`.
`generate.ts` uses `getTenantId()` for task creation and the digest setting, so
no job row is ever attributed to a default/session tenant.

### What the extension does NOT cover

- **Scalar FK ids** from form data (e.g. `staffId`, `serviceId`,
  `createdFromAppointmentId`) are plain strings, not Prisma relations, so the
  extension cannot validate them. Every such call site performs a scoped
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
| 4 | `src/app/[tenant]/app/patients/[id]/page.tsx:53` | `$executeRaw` | `SELECT pg_advisory_xact_lock(hashtext('view:<tenantId>:<patientId>:<userId>'))` | **Yes** — lock key namespaced by tenant |
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
20 files, grouped as:

- **Library/core** — `prisma-base.ts` (the client itself), `tenant-prisma.ts`
  (the extension), and the three tenant test files that deliberately use the
  unscoped client to set up/tear down tenants and assert raw state.
- **URL gate and cron** — `src/proxy.ts` (resolves the slug before any page or
  API runs) and `src/app/[tenant]/api/jobs/messages/route.ts` (fans out over all
  serving tenants).
- **Seeds** — `prisma/seed*.ts`, which create tenants and need the unscoped
  client to bootstrap data across tenants.
- **Maintenance/QA scripts** — client export, login-secret setter, the
  local-only two-tenant e2e seeder, QA reset/change scripts, and the two global
  backfill/audit scripts above.

Any new file that needs the unscoped client must be added to the allowlist with
a rationale here. Application features must use the scoped `@/lib/prisma`.

## Verification

- `npm run tenancy:check` — allowlist guard (also in CI).
- `npm run typecheck` — no type errors.
- `npm test` — includes `src/lib/tenant-prisma.test.ts` (schema-derived model
  list, nested writes, transactions, mismatches),
  `src/lib/tenant-isolation.test.ts` (two temporary tenants across lists,
  detail-by-id, updates/deletes, export, search, uploads, public feeds, cron),
  `src/lib/session-tenant.test.ts` (foreign/missing session 404s),
  `src/lib/ratelimit.test.ts` (per-tenant budgets),
  `src/lib/tenant-request.test.ts` (request-context detection and fail-closed
  login path), `src/lib/tenant-path.test.ts` (stored image paths resolve to the
  public tree) and `src/modules/public-site/tenant-seo.test.ts` (per-tenant
  sitemap, robots config and the `robots.txt` route handler).
  DB-backed tests self-guard to `127.0.0.1:5433/vision_erp` and refuse any
  other database.
- `npx tsx scripts/seed-e2e-tenants.ts` — local-only; creates `finan` (with the
  `LOGIN_SECRET_PATH` secret) and `bright-dental` (different secret).
- `npx playwright test` — `e2e/tenant-url-isolation.spec.ts` logs in as tenant A
  and walks every tenant-B page/API/SEO route expecting 404, checks A's secret
  at B (404), and asserts per-tenant public data and SEO.
- `bash scripts/smoke.sh` — tenant-prefixed URLs plus cross-tenant session,
  secret, upload and SEO checks; refuses non-local database hosts.

## Known limitations

- This is path-based tenancy (`/[tenant]/...`), not host/subdomain-based. It
  works on a single domain and behind any path-preserving proxy.
- `runWithTenant()` uses `AsyncLocalStorage`; React child rendering does not
  reliably inherit that scope, so request flows depend on proxy headers rather
  than ALS. Every request must pass through the proxy (the matcher excludes only
  `_next`).
- Rate limiting is process-local (`Map`). A multi-instance deployment needs a
  shared store keyed the same way (`tenantRateLimitKey`).
- Cron runs sequentially across serving tenants. Large fleets should add bounded
  concurrency without removing the per-tenant `runWithTenant()` scope.
