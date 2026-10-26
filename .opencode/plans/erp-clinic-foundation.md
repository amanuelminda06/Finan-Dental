# ERP slice: Vision Eye Clinic starter (foundation+auth, patients, sales, appointments)

Build a **new Next.js app** at `1st 20 service providers/erp/` (inside the existing git repo), per the
project prompt. Existing Express/Vite public site untouched. Access via secret link
`/login/<LOGIN_SECRET_PATH>` (env, wrong path → 404). DB = embedded local PostgreSQL (npm
`embedded-postgres`, no sudo/docker), `DATABASE_URL` remains the switch for a real server later.

Stack: Next.js (App Router) + TS · PostgreSQL · Prisma · Auth.js credentials · Tailwind · zod ·
next-intl (en/am) · Vitest · Playwright. Modular monolith, modules only talk via `index.ts`.

## File tree (target)

```
erp/
├── package.json                 # scripts: dev, build, db:up, db:migrate, db:seed, test, test:e2e, lint
├── next.config.ts · tsconfig.json · postcss.config.mjs · eslint · vitest.config.ts · playwright.config.ts
├── .env · .env.example · .gitignore · README.md
├── scripts/db.mjs               # start embedded Postgres (idempotent), create database
├── prisma/schema.prisma · prisma/seed.ts
├── messages/en.json · messages/am.json        # i18n keys — zero hard-coded UI strings
├── e2e/login.spec.ts · e2e/patients.spec.ts   # Playwright
└── src/
    ├── middleware.ts            # 1) secret-path gate (404)  2) session gate  3) next-intl locale (prefix: never)
    ├── auth.ts · auth.config.ts # Auth.js v5 credentials + JWT session {sub,name,role}
    ├── types/next-auth.d.ts
    ├── app/
    │   ├── layout.tsx · not-found.tsx
    │   └── [locale]/
    │       ├── layout.tsx                       # <html>, NextIntlClientProvider
    │       ├── login/[secret]/page.tsx          # re-validates secret server-side
    │       └── (app)/                           # requires session (middleware + layout)
    │           ├── layout.tsx                   # nav shell, role-aware, sign-out
    │           ├── page.tsx                     # home menu
    │           ├── patients/page.tsx · patients/[id]/page.tsx
    │           ├── sales/page.tsx
    │           └── appointments/page.tsx
    ├── lib/                                     # shared
    │   ├── prisma.ts · settings.ts              # singleton client; currency/timezone from DB settings
    │   ├── require-role.ts                      # THE single requireRole([...]) helper (rule 2) + hasRole (tested)
    │   ├── roles.ts                             # role → permission matrix (pure, tested)
    │   ├── audit.ts                             # writeAudit(...) → audit_log (rule 3), incl. VIEW
    │   ├── money.ts (+ .test.ts)                # Decimal-only math, NUMERIC(12,2), ETB format (rule 1)
    │   ├── phone.ts (+ .test.ts)                # E.164 normalize (rule 8)
    │   ├── datetime.ts (+ .test.ts)             # UTC ↔ Africa/Addis_Ababa (rule 7)
    │   └── errors.ts                            # zod → friendly field-level errors (rule 6)
    └── modules/  {auth, patients, sales, appointments}/
        ├── index.ts                # public API only — cross-module imports go here
        ├── services/*.ts           # pure-ish business logic (tested where valuable)
        ├── actions.ts              # 'use server' — every action: requireRole → zod → service → audit
        └── components/*.tsx        # forms/tables: autofocus, Enter submits, search+filter+pagination,
                                    # loading/empty states, confirm dialogs, a11y labels
```
(Not built — rule 13: hr, messaging, website modules, settings UI, doctor-assignment, reports.)

## Data model (prisma/schema.prisma)

- `Branch` (singleton now) · `User` (username, bcrypt hash, `Role {OWNER,RECEPTION,STAFF}`, active,
  `branchId?`) · `ClinicSettings` singleton (`currency=ETB`, `timezone=Africa/Addis_Ababa`, clinic name)
- `AuditLog` (user, entity, entity_id, action, old_json, new_json, ip, timestamp) — no hard delete
- `Patient` (first/last name, phone E.164, gender?, birthDate?, non-clinical `notes`, `active`,
  `branchId?`) — soft delete via `active=false`
- `ServiceItem` (name, `price Decimal(12,2)`, active) · `Sale` (`number` unique seq via `Counter`,
  `total Decimal(12,2)`, `status {CONFIRMED,VOIDED}`, voidReason/voidedAt/voidedBy, `patientId?`,
  `branchId?`) · `SaleLine` (unitPrice/lineTotal `Decimal(12,2)`)
- `Appointment` (patient, `startsAt/endsAt` UTC, `status {SCHEDULED,COMPLETED,CANCELLED,NO_SHOW}`,
  non-clinical notes, `branchId?`)
- `branchId?` nullable only on transactional entities (Patient/Appointment/Sale/User) per intro note.
- No diagnoses/prescriptions/clinical notes anywhere (rule 9).

## Key rules → mechanics

1. Money: `decimal.js` helpers in `lib/money.ts`, Prisma `Decimal`/`@db.Decimal(12,2)`; totals computed server-side.
2. `requireRole([Role.X])` at top of every server action; UI hides per role but never trusts UI.
3. `writeAudit` in every create/update/void/status-change/login-failure; patient detail page logs `VIEW`.
5. Sales: only create CONFIRMED; corrections = `void(reason)` + re-enter; immutable lines.
7. Times: store UTC (`DateTime @updatedAt` etc.), format/compare with `lib/datetime.ts` using settings timezone.
8. Phone: `normalizePhone()` on every write — accepts `09XXXXXXXX / 9XXXXXXXX / +2519XXXXXXXX`.
10. i18n: `messages/en.json` + `messages/am.json`; server `getTranslations`, client `useTranslations`.

## Seed (prisma/seed.ts)

Settings row · 3 users: `owner`/`reception`/`doctor` (passwords from env or dev defaults, printed once) ·
~6 eye-clinic ServiceItems with ETB prices (eye exam, lens, frame, etc.) · 1 Branch.

## Build order (commit-sized)

1. `chore(erp)` scaffold: create-next-app (TS/Tailwind/src-dir) + deps + vitest/playwright config
2. `feat(erp)` schema + `scripts/db.mjs` embedded PG + migrate
3. `feat(erp)` auth foundation: Auth.js, secret gate, requireRole, audit, i18n, app shell, seed
4. `feat(erp)` patients module (+ unit tests phone/roles)
5. `feat(erp)` sales module (+ money tests, immutable/void flow)
6. `feat(erp)` appointments module (+ datetime tests)
7. `test/docs` e2e (secret gate, login, patient create), README runbook

## Verification per slice
`npm run lint` · `npx vitest run` · `npm run build` · smoke: `/login/x`→404, login→session,
unauthed action→error, money/phone/timezone tests green. Playwright at the end.

## Known limits to report at the end
- Embedded PG is dev-only; production needs a real `DATABASE_URL` (Supabase IPv4 pooler).
- messaging/hr/website modules, settings UI, reports not built (rule 13).
- Passwords seeded for dev must be rotated.
