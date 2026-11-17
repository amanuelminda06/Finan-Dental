# Baseline before multi-tenancy (schema expand)

Captured on branch `multitenant` at commit `c786978`, before any tenancy change.
File paths and test counts below describe that historical commit; after the
URL-tenancy work the routes live under `src/app/[tenant]/...` and the current
checks are documented in `docs/tenancy.md`.

Database: local embedded PostgreSQL only — `127.0.0.1:5433`, database `vision_erp`
(`DATABASE_URL` overridden for every command; the hosted Neon database was not
read or written).

## Commands

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | pass |
| Lint | `npm run lint` | **fail** (exit 1, 22 problems: 13 errors, 9 warnings) |
| Unit tests | `npm test` | pass (45 files, 364 tests) |
| Build | `npm run build` | pass |
| E2E | `npx playwright test` | **fail** (9 passed, 1 skipped, 2 failed) |

## Currently failing checks

### Lint (13 errors)

Pre-existing, none in code touched by the website/ERP reconnection work.

- `src/app/(app)/messages/page.tsx` — 11 × `react-hooks/error-boundaries`
  ("Avoid constructing JSX within try/catch") at lines 22, 23, 24, 25, 26, 28,
  29, 32, 33, 36, 42. Cause: the page builds JSX inside a `try/catch`, which the
  hook rule forbids because render errors cannot be caught there.
- `scripts/dump-tz.cjs:1` — `@typescript-eslint/no-require-imports` (`require()` style import).
- `scripts/update-tz.cjs:1` — `@typescript-eslint/no-require-imports` (`require()` style import).

Warnings (9, not failures): unused variables in `src/app/(app)/layout.tsx`,
`src/app/(public)/contact/page.tsx`, `src/app/(public)/page.tsx`,
`src/components/AppShell.tsx`, `src/modules/public-site/components/PublicFooter.tsx`,
and one in `prisma/seed-messaging.ts`.

### E2E (2 failed, 1 skipped)

- `e2e/leave.spec.ts` — "leave request → approval › staff requests and owner
  approves". Cause: the request **is** created (rows exist at status
  `REQUESTED`), but the spec asserts the reason text is visible on `/leave`,
  and that table renders type/dates/days/status/decision note — never the
  reason. Stale assertion.
- `e2e/patient-sale.spec.ts` — "patient → sale › reception creates a patient and
  records a sale". Cause: the spec clicks `getByRole('option')` immediately after
  focusing the service box, but `NewSaleForm` renders suggestion `<button>`s
  that only appear after typing; the only hidden match is the Doctor `<select>`
  option, so the click times out. Stale test.
- `e2e/booking.spec.ts` — skipped by its own Turnstile guard: the production
  server fails closed without Turnstile keys (422 `turnstileToken: required`).
  The flow passes in dev mode and is not a failure.

### Known log noise

`/revenue` logs `MISSING_MESSAGE: sales.catConsultation` because the page uses
the `sales` i18n namespace while category labels live under `services`. Does not
fail any check.
