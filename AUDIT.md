# Finan-Dental ERP — Read-Only Audit Report

See previous chat for full detailed tables. Summary:

## Vision Eye references
13 case-insensitive "Vision Eye" matches across 5 files; ~33 additional "visioneye" domain/email/social references.

## Riskiest findings
1. Secrets on disk: .env (Neon DB password, AUTH_SECRET, weak seeded passwords) and .env.local (Vercel OIDC token).
2. Hardcoded seeded admin credentials (owner123/reception123/doctor123).
3. Hardcoded demo patient PII in prisma/seed-patients.ts (20 patients).
4. In-memory per-process rate limiter (not multi-instance safe).
5. NextAuth trustHost: true + optional disabled Turnstile on public booking form.

## Unknowns
- Whether .env/.env.local were ever committed to git history.
- Production PUBLIC_BASE_URL value.
- Whether Neon DB is prod or staging.
- Backup scheduling/off-site status.
- Root README "# Finan-Dental" vs erp "Vision Eye Clinic ERP" naming discrepancy.

## Key platform notes
- ORM: Prisma + PostgreSQL, 17 migrations, 24 tables.
- Uploads stored in Postgres (STORAGE_DRIVER=db default) for Vercel ephemeral disk.
- No Plesk references found.
- Auth: NextAuth v5 credentials, JWT 12h, secret-link login, 15-min lockout after 5 fails, in-memory rate limit 30/5min.
- AuditLog table with field-level diffs, passwordHash redacted.
