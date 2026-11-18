# Go-live checklist

Work top to bottom. Do not launch with unchecked items in **Critical**.

## Critical (must pass)

- [ ] **Deployment** steps 1–3 done (`docs/deployment.md`, or
      `docs/deploy-vercel-neon.md` for Vercel + Neon); app reachable over HTTPS.
- [ ] `npm run typecheck && npm run lint && npm run messages && npm test` all green.
- [ ] `npm run build` succeeds; `bash scripts/smoke.sh` passes with no new failures.
- [ ] `npm run security:scan` shows **0** "needs manual review" endpoints.
- [ ] `npm run audit:deps` reports no high/critical advisories.
- [ ] Production `.env`: real `AUTH_SECRET`, real owner email, strong passwords,
      `DIRECT_URL` for migrations/CLI; `.env` is **not** in git.
- [ ] First tenant created with `npm run tenant:create` (no demo data); its
      demo credentials file stored in the clinic password manager.
- [ ] All seeded demo passwords changed; `mustChangePassword` cleared for the
      real accounts after first login.
- [ ] Backup job scheduled **and** a restore has been rehearsed into a scratch
      database (`docs/backup-restore.md`).
- [ ] Off-site backup copy configured.
- [ ] `CRON_SECRET` set and the message job scheduled (or deliberately disabled).
- [ ] Every location/URL in README/this doc points at the real domain.

## Content & clinic readiness

- [ ] OWNER completed `/<tenant>/erp/branding`: clinic name, short name,
      tagline, address, phones, email, socials, colors, logo, hero, doctor info,
      SMS sender and languages. No Finan-specific value remains in another
      clinic's URL tree.
- [ ] Clinic supplies final hero/about/hours/contact/footer/privacy copy
      (see "Public site content" below).
- [ ] Amharic copy reviewed by a native speaker (currently marked draft).
- [ ] Doctor profiles: correct staff flagged as doctors, `showOnWebsite`,
      specialty, photo (≤ 2 MB PNG/JPEG/WebP) — verify no phone/email leaks on
      `/doctors`.
- [ ] Service catalogue: public services + descriptions set; prices never shown.
- [ ] Consent-approved testimonials (or the section left empty).
- [ ] Settings: timezone (`Africa/Addis_Ababa`), currency, opening hours,
      contact numbers and working-hour windows checked. The clinic name fallback
      comes from the tenant's branding row.
- [ ] Privacy policy reviewed (the shipped text is an explicit placeholder).

## People & process

- [ ] Owner, reception and staff accounts created; roles correct.
- [ ] Staff trained on the UAT script (`docs/uat.md`) and signed off.
- [ ] Manual test checklist in README items that need a human completed
      (especially real-device SMS link test, items 36 and 48 Lighthouse).
- [ ] Known gaps reviewed and accepted (`docs/known-gaps.md`).
- [ ] Support contact + escalation path agreed (see `docs/troubleshooting.md`).

## Day-1

- [ ] Take a fresh backup immediately after go-live.
- [ ] Watch the audit log (`/<tenant>/erp/audit`) for unexpected `LOGIN_FAILED` bursts.
- [ ] Confirm `/<tenant>/api/public/doctors` loads on the live site with correct statuses.
- [ ] Confirm `/` redirects to the default tenant and each tenant's
      `sitemap.xml`/`robots.txt` lists only its own URLs.
- [ ] Confirm each tenant's metadata, CSS colors, logo/hero and rendered SMS
      preview show only that clinic's branding.
- [ ] Confirm the messages badge / outbox matches what reception expects.

## Public site content (clinic to provide)

Before launch the clinic must supply the items listed in README →
"Public website — clinic-provided content": final copy, contact details,
reviewed Amharic, testimonials, doctor profiles/photos, public service
descriptions, analytics decision, `PUBLIC_BASE_URL`, optional Turnstile keys.
