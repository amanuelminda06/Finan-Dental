# Smoke baseline before multi-tenancy

Check descriptions and flight-redirect needles below describe the historical
root-relative URLs at commit `c786978`. The current smoke script prefixes every
URL with `/<tenant>` and adds cross-tenant checks; see `docs/tenancy.md`.

Captured at commit `c786978` (the commit immediately before
`68d5a7b`, which added the multi-tenancy foundation).

## Method

- Temporary Git worktree at `c786978`.
- Temporary local embedded PostgreSQL database `vision_erp_baseline_smoke`
  on host `127.0.0.1:5433`; `DATABASE_URL` and `DIRECT_URL` were overridden for
  every command. Hosted Neon was neither read nor written.
- Baseline schema deployed with `prisma migrate deploy`, then `npm run db:seed`,
  then `npm run build` and `npm run start -- -p 3100`.
- `scripts/smoke.sh` at `c786978` hardcodes `owner@finandental.com`,
  `reception@finandental.com` and `doctor@finandental.com`, while the seed at
  that commit uses the addresses configured in `.env`. Only those three login
  identities were replaced with the seeded-account env variables that existed
  at that commit in the temporary worktree. Those variables were later removed
  in favour of fixed trial logins (`owner`/`owner123`, `reception`/`reception123`,
  `doctor`/`doctor123`) accepted as short names. No application source was changed.

## Result

Baseline: **128 passed, 37 failed**.
Current clean seed on `multitenant`: **159 passed, 20 failed**.
The current script refreshes stale fixture assertions (patient names/phone and
service name) to match the seed at this commit and adds tenant URL/isolation
checks, so check names are not identical. Every remaining failure is in a
category already present at baseline; no tenancy regression was introduced.

## Classification of the 20 current failures

All are pre-existing categories. Sub-causes:

| Sub-cause | Failures | Examples |
| --- | --- | --- |
| Stale redirect-shape expectations (the app intentionally renders `NEXT_REDIRECT` in the RSC flight payload; `cacheComponents` makes HTTP status differ from the flight payload) | 7 | `reception /users (no force)`, reception/staff role redirects |
| Missing confirmed sales after a clean seed | 4 | `sales list has receipts`, `owner sale detail` |
| Public booking fails closed without Turnstile keys (environment, not code) | 4 | `public booking valid → 200`, `public booking auto-created a CONFIRMED appointment` |
| CSV/template header drift | 3 | `CSV header`, `template columns`, `consent filter → 11 rows` |
| Other stale page assertions already present at baseline | 2 | `owner /messages/campaigns/new → 200`, `staff /messages forbidden` |

### Full failing check names (current)

1. `reception /users (no force) → 200 (flight redirect)`
2. `CSV header`
3. `consent filter → 11 rows`
4. `template columns`
5. `staff /patients → 200 (flight redirect)`
6. `sales list has receipts`
7. `owner sale detail → 200`
8. `sale receipt renders`
9. `sale audit trail`
10. `reception /revenue → 200 (flight redirect)`
11. `reception /dashboard/services → 200 (flight redirect)`
12. `staff /sales → 200 (flight redirect)`
13. `staff /leave/inbox → 200 (flight redirect)`
14. `public booking valid → 200`
15. `public booking returns ok`
16. `public booking names the slot`
17. `public booking auto-created a CONFIRMED appointment`
18. `staff /appointments → 200 (flight redirect)`
19. `owner /messages/campaigns/new → 200`
20. `staff /messages forbidden`
