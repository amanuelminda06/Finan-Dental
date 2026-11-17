# Smoke baseline before multi-tenancy

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
  identities were replaced with the existing `OWNER_EMAIL`, `RECEPTION_EMAIL`
  and `STAFF_EMAIL` variables in the temporary worktree. No application source
  was changed.

## Result

Baseline: **128 passed, 37 failed**.
Current clean seed at `8e6f98d`: **128 passed, 37 failed**.
The failing check names and values are identical, so **all 37 current failures
are pre-existing**. No tenancy regression was introduced and no regression fix
is required.

## Classification of the 37 failures

All are pre-existing. Sub-causes:

| Sub-cause | Failures | Examples |
| --- | --- | --- |
| Stale redirect-shape expectations (the app intentionally renders `NEXT_REDIRECT` in the RSC flight payload with HTTP 200/307 differences under `cacheComponents`) | 9 | `no session / → 307`, reception/staff role redirects |
| Stale seed-fixture names in assertions | 5 | `Almaz Tesfaye`, `Fatuma Hassan`, `Bekele Wolde`, `Eye Consultation` |
| Missing confirmed sales after a clean seed | 4 | `sales list has receipts`, `owner sale detail` |
| Public booking fails closed without Turnstile keys (environment, not code) | 4 | `public booking valid → 200`, `public booking auto-created a CONFIRMED appointment` |
| CSV/template header drift | 3 | `CSV header`, `template columns`, `consent filter → 11 rows` |
| Other stale page/detail assertions already present at baseline | 12 | detail-page content, `/services/new` 404, campaign form, `/403` redirects |

### Full failing check names (same at baseline and current)

1. `no session / → 307`
2. `redirect target:`
3. `reception /users → 200 (flight redirect)`
4. `reception forced-change redirect`
5. `reception /users (no force) → 200 (flight redirect)`
6. `staff forced-change redirect`
7. `seed patient row`
8. `phone search finds the patient`
9. `owner patient detail → 200`
10. `tap-to-call shows stored E.164`
11. `non-clinical notes hint`
12. `consent block`
13. `detail page wrote no VIEW audit`
14. `CSV header`
15. `consent filter → 11 rows`
16. `template columns`
17. `staff /patients → 200 (flight redirect)`
18. `seeded service row`
19. `owner /services/new → 200`
20. `sales list has receipts`
21. `owner sale detail → 200`
22. `sale receipt renders`
23. `sale audit trail`
24. `reception /revenue → 200 (flight redirect)`
25. `reception /services forbidden`
26. `staff /sales → 200 (flight redirect)`
27. `staff /leave/inbox → 200 (flight redirect)`
28. `appointments list shows patient`
29. `week view renders patient`
30. `overdue tab lists overdue patient`
31. `public booking valid → 200`
32. `public booking returns ok`
33. `public booking names the slot`
34. `public booking auto-created a CONFIRMED appointment`
35. `staff /appointments → 200 (flight redirect)`
36. `owner /messages/campaigns/new → 200`
37. `staff /messages forbidden (missing: NEXT_REDIRECT;replace;/403)`
