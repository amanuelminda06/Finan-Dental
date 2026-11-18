# Deploy to Vercel with Neon (Lakebase Postgres)

This is the recommended hosted path for a clean install. One Next.js deployment
serves every clinic under a URL tree (`/<tenant>/...`); the database is a Neon
Lakebase Postgres branch. Tenancy is **path-based**, not host-based, so a custom
domain can be added later without changing the routing model.

> Local verification must stay on the embedded Postgres
> `127.0.0.1:5433/vision_erp`. The provisioning CLI refuses a hosted database
> unless `--allow-hosted` is passed deliberately, and always prints the target
> host/database before doing any work.

## 1. Create the Neon project

Use the Neon Console or CLI. With the CLI:

```bash
npm i -g neon
neon auth                    # human sign-in; do not run unattended
neon init --agent opencode   # creates/links a project and installs skills
```

Record the two connection strings from **Connect → Connection details** on the
branch you intend to serve:

| Value  | Hostname contains | Use                                                     |
| ------ | ----------------- | ------------------------------------------------------- |
| Pooled | `-pooler.`        | `DATABASE_URL` used by the running app                  |
| Direct | no `-pooler`      | `DIRECT_URL` used only by migrations and the tenant CLI |

Both include `sslmode=require`. Keep them out of git; they are Vercel project
secrets (and may be a local gitignored `.env` for one-off administration).

## 2. Create the Vercel project

Import the repository with:

- **Root directory:** `erp`
- **Framework preset:** Next.js
- **Install command:** `npm ci`
- **Build command:** `npm run build`

Set these project environment variables for Production (and separately for any
Preview environment, using that branch's pooled/direct URLs):

| Variable                                | Value                                                              |
| --------------------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`                          | Neon **pooled** connection string                                  |
| `DIRECT_URL`                            | Neon **direct** connection string                                  |
| `AUTH_SECRET`                           | `openssl rand -base64 32`                                          |
| `AUTH_URL`                              | full canonical origin, e.g. `https://erp.example.com`              |
| `DEFAULT_TENANT_SLUG`                   | `finandentalclinic` — `/` redirect target                            |
| Fixed trial logins                      | `owner`/`owner123`, `reception`/`reception123`, `doctor`/`doctor123`; no env vars |
| `PUBLIC_BASE_URL`                       | same canonical origin as `AUTH_URL`                                |
| `STORAGE_DRIVER`                        | `db` — uploads live in Postgres; Vercel has no persistent disk     |
| `NEXT_PUBLIC_TRIAL_BANNER`              | `false` once the first clinic is live                              |
| `SMS_SENDER_NAME`                       | optional per-tenant default; OWNER can override it in branding     |
| `CRON_SECRET`                           | `openssl rand -hex 24` — enables the bearer-protected job endpoint |
| `DEFAULT_TENANT_SLUG`                   | `finandentalclinic` — the protected platform tenant                |

`TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are optional. Booking
is disabled if they are configured incorrectly, so leave them unset until the
keys are known to work.

Everything is validated at boot by `src/env.ts`; a bad value stops startup and
only the key name is logged.

## 3. Apply migrations

Prisma 6 reads `DATABASE_URL` from `prisma/schema.prisma`. Migrations need the
**direct** connection, so override it for the CLI command (the running app keeps
the pooled value):

```bash
# From a trusted machine/CI job with the production values exported:
export DIRECT_URL='postgresql://...@ep-...neon.tech/neondb?sslmode=require'
DATABASE_URL="$DIRECT_URL" npm run db:deploy   # prisma migrate deploy
DATABASE_URL="$DIRECT_URL" npm run seed:platform -- --allow-hosted
npm run tenancy:check                          # base-client allowlist guard
```

`seed:platform` only creates `finandentalclinic` when it is absent; if the tenant
already exists it changes nothing. `npm run db:seed` refuses to overwrite the
protected tenant. `tenant:create` below provisions additional clinics with the
same starter template but **no invented patients** unless `--demo-data` is passed.

## 4. Add another tenant

From a trusted machine, with the same full env as the app and `DATABASE_URL`
temporarily set to the direct connection:

```bash
DATABASE_URL="$DIRECT_URL" npm run tenant:create -- \
  bright-dental "Bright Dental" owner@example.com --allow-hosted
```

For another clinic:

```bash
DATABASE_URL="$DIRECT_URL" npm run tenant:create -- \
  bright-dental "Bright Dental" owner@bright.example --allow-hosted
```

The CLI checks the slug (3–40 lowercase letters/digits/hyphens, reserved names
rejected), prints `Database: <host>:<port>/<database>`, seeds the dental
template into **that tenant only** and creates OWNER/RECEPTION/DOCTOR trial
accounts with `mustChangePassword: false`. Their logins are fixed for every
tenant (`owner`/`owner123`, `reception`/`reception123`, `doctor`/`doctor123`) —
no env vars and no credentials file. Before taking a clinic live, run
`npm run tenant:activate -- <slug> --allow-hosted` to set it ACTIVE and force
every user through a strong-password change. The login page is open at
`/<slug>/erp/login`; tenant isolation comes from the URL, not from a secret path.

Other maintenance commands:

```bash
DATABASE_URL="$DIRECT_URL" npm run tenant:extend -- finan --days 30 --allow-hosted
DATABASE_URL="$DIRECT_URL" npm run tenant:suspend -- finan --allow-hosted
DATABASE_URL="$DIRECT_URL" npm run tenant:reset-demo -- finan --allow-hosted
DATABASE_URL="$DIRECT_URL" npm run tenant:delete -- finan --force --allow-hosted
```

`tenant:delete` refuses an `ACTIVE` tenant without `--force`; suspended or
expired tenants answer 404 everywhere. Suspend first unless deletion is
intentional. `tenant:reset-demo` preserves the tenant identity, owner and
OWNER-edited branding while replacing demo data.

## 5. Deploy and verify

Deploy the Vercel project, then check:

```bash
curl -fsS https://erp.example.com/ >/dev/null                              # 307 to /finandentalclinic
curl -fsS https://erp.example.com/finandentalclinic/ >/dev/null            # public home
curl -fsS https://erp.example.com/finandentalclinic/sitemap.xml | head     # scoped sitemap
curl -fsS https://erp.example.com/finandentalclinic/robots.txt | head      # scoped robots
curl -fsS https://erp.example.com/<slug>/erp/login >/dev/null              # open login
```

Sign in with the fixed trial logins, then open
`/<tenant>/erp/branding`. That form is the source of truth for clinic name,
tagline, address, phones, email, socials, colors, logo, hero, doctor information,
SMS sender and languages. All metadata, JSON-LD, OpenGraph, CSS variables, public
images and rendered message previews follow those tenant-owned values. Static
files in `public/` are only seed defaults copied into each tenant's storage.

## 6. Cron fan-out

`POST /<any-serving-tenant>/api/jobs/messages` is a platform endpoint: the URL
tenant is only the carrier, and the job fans out over every TRIAL/ACTIVE tenant
in its own `runWithTenant()` scope. Set `CRON_SECRET`, then schedule it with
Vercel Cron, a GitHub Action, or an external scheduler:

```cron
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://erp.example.com/finan/api/jobs/messages
```

Without `CRON_SECRET` the endpoint returns 503; a missing/wrong bearer returns 401. The response is `{ ok, tenants, results: [{ tenant, summary }] }`. Jobs run
sequentially; with a large fleet, add bounded concurrency while keeping the
per-tenant scope. If a single invocation approaches the platform function time
limit, split the fan-out or move it to a long-running worker.

## 7. Rotating secrets

| Secret             | Rotation                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_SECRET`      | Generate a new value, set it in Vercel, redeploy. All existing JWT sessions are invalidated, so users sign in again.                                                                                                                             |
| `CRON_SECRET`      | Set the new value in Vercel and in the scheduler together. Expect at most one failed run during the cutover.                                                                                                                                     |
| Owner password     | OWNER resets it from `/<tenant>/erp/users`; `tenant:activate` forces all users through a strong-password change before go-live.                                                                                                             |
| Neon role password | Rotate in Neon, update `DATABASE_URL` and `DIRECT_URL` in Vercel, redeploy, and rerun the migration command with the new direct URL.                                                                                                             |


## 8. Custom domain later

The app already supports path-based tenancy on one domain. To use a custom
domain:

1. Add it in Vercel and point DNS at the deployment.
2. Set `AUTH_URL` and `PUBLIC_BASE_URL` to that one canonical HTTPS origin.
3. Re-verify sitemap/robots, OpenGraph URLs and the open login page.

A vanity **hostname per clinic** (for example `clinic.example.com` instead of
`/clinic`) is a different routing model and is not implemented. Keep one
canonical domain with tenant prefixes until that feature is explicitly added.
