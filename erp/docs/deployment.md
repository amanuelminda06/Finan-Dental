# Deployment

One Next.js build serves every clinic under one URL tree per tenant. The bare
`/` redirects to the default tenant (`DEFAULT_TENANT_SLUG`); everything else is
prefixed with the tenant slug:

1. **Public website** — `/<tenant>/`, `/<tenant>/about`, `/<tenant>/services`,
   `/<tenant>/doctors`, `/<tenant>/book`, `/<tenant>/contact`, `/<tenant>/faq`,
   `/<tenant>/privacy`, plus `/<tenant>/sitemap.xml` and `/<tenant>/robots.txt`.
2. **ERP** — `/<tenant>/app/...`, secret-link login at
   `/<tenant>/login/<that tenant's LOGIN_SECRET_PATH>`.
3. **APIs** — `/<tenant>/api/...` (auth, exports, uploads, public feeds, cron).

The tenant is resolved from the first URL segment and checked on every request
(unknown/suspended/expired tenants 404). Sessions, secrets, rate limits and
locale cookies are bound to one tenant; see `docs/tenancy.md`.

For a fresh hosted install, follow [`docs/deploy-vercel-neon.md`](deploy-vercel-neon.md).
This page covers the general self-hosted/long-lived-server path; the Neon guide
adds pooled/direct connection strings, first-tenant provisioning and secret
rotation.

## Prerequisites

- Node.js 20+ and npm.
- PostgreSQL 16+ reachable via `DATABASE_URL`.
- A reverse proxy/TLS terminator (Caddy, nginx, or a platform LB).
- PostgreSQL client tools (`pg_dump`/`pg_restore`/`psql`) for backups.

## 1. Configure

```bash
cp .env.example .env
```

Fill, at minimum:

| Key | Notes |
| --- | --- |
| `DATABASE_URL` | production Postgres; use Neon's **pooled** string for serverless, add `?sslmode=require` when required |
| `DIRECT_URL` | Neon's **direct** string, for migrations and tenant CLI only; see `docs/deploy-vercel-neon.md` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `LOGIN_SECRET_PATH` | `openssl rand -hex 12` — seed-time secret for the default tenant's `/<tenant>/login/<secret>`; each `Tenant.loginSecret` is authoritative at runtime |
| `DEFAULT_TENANT_SLUG` | `finan` — where `/` redirects and which tenant seed/scripts use (never a fallback in request handling) |
| `E2E_SECOND_TENANT` | `bright-dental` — local isolation-check tenant created by `tenant:create` |
| `OWNER_EMAIL` / `OWNER_PASSWORD` | first owner account; password ≥ 10 chars |
| `RECEPTION_EMAIL` / `RECEPTION_PASSWORD` | created with forced password change |
| `STAFF_EMAIL` / `STAFF_PASSWORD` | created with forced password change |
| `UPLOAD_DIR` | persistent volume path (e.g. `/var/lib/vision-erp/uploads`); ignored when `STORAGE_DRIVER=db` |
| `STORAGE_DRIVER` | `db` keeps uploads in Postgres — required on ephemeral platforms such as Vercel |
| `PUBLIC_BASE_URL` | canonical https origin (SEO/hreflang/sitemap) |
| `CRON_SECRET` | ≥ 16 chars to enable `POST /<tenant>/api/jobs/messages` (runs for all serving tenants) |

Everything is validated at boot (`src/env.ts`) — the app refuses to start on a
bad/missing value and never logs the values.

## 2. Build & migrate

```bash
npm ci
npx prisma generate
DATABASE_URL="$DIRECT_URL" npm run db:deploy  # Prisma 6: migrations need the direct URL
npm run tenancy:check                        # base-client allowlist guard
npm run build
npm start              # or a process manager (systemd/pm2) on :3000
```

> `npm run db:seed` inserts demo patients/sales/HR/appointments. Prefer
> `npm run tenant:create` on a clean production database: it applies the same
> dental starter template with no invented patients and creates the first OWNER
> with a one-time password. See `docs/deploy-vercel-neon.md` for hosted usage.

### First tenant

```bash
DATABASE_URL="$DIRECT_URL" npm run tenant:create -- \
  <slug> "<clinic name>" <owner email> --allow-hosted
```

The CLI prints the target host/database, then the owner email, one-time password
and login path once. The OWNER edits branding at `/<tenant>/app/branding`;
`public/` images are only seed defaults copied into the tenant's own storage.

## 3. Reverse proxy

Terminate TLS and forward to `127.0.0.1:3000`. Example (Caddy):

```
erp.finandental.com {
  reverse_proxy 127.0.0.1:3000
  encode zstd gzip
}
```

The app already sets CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS (prod),
Referrer-Policy and Permissions-Policy (`next.config.ts`). Do not weaken CSP.

## 4. Scheduled jobs

Messages no longer require a server (manual-link mode), but the daily job that
expires/creates tasks and the optional daily summary email should run:

```cron
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://erp.finandental.com/finan/api/jobs/messages
```

The URL tenant is only the carrier: the endpoint fans out over every TRIAL or
ACTIVE tenant in its own `runWithTenant()` scope and returns a per-tenant
`results` array. Pointing the cron at any serving tenant URL has the same effect.

## 5. Health & smoke

```bash
curl -fsS http://127.0.0.1:3000/finan/login/<LOGIN_SECRET_PATH> >/dev/null
npx tsx scripts/seed-e2e-tenants.ts          # local embedded DB only: two isolation tenants
bash scripts/smoke.sh                       # tenant-aware checks, server on :3100
npm run security:scan                       # regenerates docs/security-review.md
```

The e2e seeder and smoke script refuse hosted databases. Do not run them against
the Neon branch; use the live URL checks and `tenant:*` CLI commands there.

## Upgrades

```bash
npm run backup                    # always before deploying
git pull
npm ci
npm run db:deploy                 # new migrations
npm run build
# restart the service
```

`prisma migrate deploy` is forward-only; never edit applied migrations.

## Rollback

Restore the pre-deploy dump (`npm run restore -- <file>`), check out the
previous release and `npm run build`, restart. Keep the last known-good release
directory on disk for instant switch-back.
