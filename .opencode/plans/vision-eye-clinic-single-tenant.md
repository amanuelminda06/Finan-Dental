# Convert multi-store SaaS → single secured client: Vision Eye Clinic

## Context

The repo at `1st 20 service providers/` is a generic multi-tenant white-label platform ("ServiceSaaS"/"AddisDR"):
Express + PostgreSQL (Supabase) backend, React/Vite SPA. Tenancy = `businesses` table, passed as an
`x-business-id` header on every API call, resolved client-side from subdomain / `?business=` / `/:slug`.

Problems for a single-client deployment:
- 6 demo tenants seeded; public `/api/business/directory` leaks all of them; `/superadmin` CRUDs tenants.
- **Admin write endpoints have zero server-side auth** — anyone knowing an integer id can mutate data.
- Super-admin auth is plaintext `username:password` echoed on every request; `businesses.admin_password` plaintext.
- CORS accepts any `Host`; `/api/debug` exposes env.

**Confirmed decisions:** remove `business_id` entirely (full refactor) · repurpose superadmin → Clinic Settings ·
full security hardening · placeholder eye-care seed content · multiple named admin accounts · clean URLs
(`/` storefront, `/admin` panel).

All paths below are relative to `1st 20 service providers/`.

---

## Phase 1 — Database migration

New file `backend/migrate-single-tenant.js` (same self-executing style as `migrate-add-is_special.js`),
plus the canonical SQL recorded in `DEPLOYMENT.md`:

1. **`businesses` → `clinic_settings`** (rename; singleton row enforced with `CHECK (id = 1)`):
   keep `id, name, logo_url, hero_image_url, tagline, about, phone, address, map_url,
   color_primary/secondary/tertiary, staff_display, gallery_display, created_at, updated_at`;
   **drop** `subdomain`, `status`, `admin_password`.
2. **Drop `business_id`** column + FK from `services, service_categories, staff, work_hours, reservations, feedback`
   (and delete all demo rows belonging to the 6 throwaway tenants).
   `work_hours` unique becomes `UNIQUE(day_of_week)`.
3. **Create `admin_users`**: `id, username UNIQUE, password_hash (bcrypt), role ('owner'|'staff'),
   active, last_login_at, timestamps`.
4. **Drop `super_admins`** (plaintext credentials) and the old `businesses` leftovers.
5. Keep `service_images`, `reservations`, `feedback` FKs that hang off `services` — unchanged.

Data safety note: migration deletes the 6 demo businesses and their content — intended, they are placeholders.

## Phase 2 — Backend

**New files**
- `backend/middleware/auth.js` — `requireAuth`: verify `Authorization: Bearer <JWT>` (jsonwebtoken,
  expiry ~12h, secret from `JWT_SECRET`), attach `req.admin`; `requireOwner` for account management.
- `backend/routes/auth.js` — `POST /login` (bcrypt compare, per-IP rate limit 10/15min, returns
  `{token, user}`), `GET /me`, `PATCH /password` (change own password). **No more** `/api/superadmin/admin-login`.
- `backend/routes/adminUsers.js` (requireAuth + requireOwner) — list/create/update/deactivate/delete
  admin accounts, reset password. Owner account cannot be deleted/deactivated.

**Rewrites**
- `backend/db.js` — delete `getBusinessId` / `requireBusiness` (L35-54); export only `query`, `queryOne`.
- Content routes — drop every `requireBusiness` call and `business_id` predicate in SQL; attach
  `requireAuth` to **all mutating** endpoints and admin reads:
  | File | Public (no auth) | Requires auth |
  |---|---|---|
  | `routes/services.js` | `GET /`, `GET /:id` | `GET /admin`, POST, PUT, PATCH, DELETE ×2 |
  | `routes/serviceCategories.js` | `GET /` | POST, PUT, DELETE |
  | `routes/staff.js` | `GET /` | `GET /admin`, POST, PUT, DELETE |
  | `routes/workHours.js` | `GET /`, `GET /current-status` | `PUT /` |
  | `routes/feedback.js` | `POST /` (rate-limited), `GET /public` | `GET /admin`, PATCH, DELETE |
  | `routes/reservations.js` | `POST /` (rate-limited) | `GET /stats` |
  | `routes/analytics.js` | — | all |
- `routes/business.js` → `routes/clinic.js` — `GET /api/clinic` (public singleton settings),
  `PUT /api/clinic` (requireAuth, existing multipart logo/hero upload). **Delete** `/by-subdomain/:slug`
  and `/directory`.
- `routes/superadmin.js` — **delete file**.
- `server.js`:
  - mount `/api/auth`, `/api/admin-users`, `/api/clinic`; remove superadmin + business mounts (L51-52).
  - **CORS**: static `ALLOWED_ORIGINS` allowlist only — remove the dynamic `Host` push (L27-34).
  - **Delete `/api/debug`** (L61-78).
  - Add stricter `authLimiter` (e.g. 10 req/15min) on `/api/auth/login`.
  - Update startup banner (L91-93).

**Dependencies** (`backend/package.json`): add `bcryptjs`, `jsonwebtoken`.

## Phase 3 — Frontend

**API layer** `frontend/src/api.js`
- Axios request interceptor attaches `Authorization: Bearer` from `localStorage.auth_token`; response
  interceptor clears token + redirects to `/admin` on 401.
- Strip `businessId` param + `bizHeaders()` from every function (≈35 functions).
- Remove `superAdminApi`, `saHeaders`, all `sa*` functions, `getBusinessBySubdomain`.
- Add: `authLogin/authMe/authChangePassword`, `adminUsers*`, `getClinic/updateClinic`.

**Contexts**
- `context/BusinessContext.jsx` → **`context/ClinicContext.jsx`**: no subdomain/query/slug resolution —
  one `GET /api/clinic` on mount, exposes `{clinic, loading, setClinic}`; `useClinic()` hook.
  Update ~10 importing files (`ServicePage`, `AdminLayout`, admin pages, components).
- `context/AdminAuthContext.jsx` → holds `{token, user}` (localStorage), `login/logout/isOwner`.
- **Delete** `context/SuperAdminContext.jsx`.

**Routing** `frontend/src/App.jsx`
```
/                     → ClinicProvider + ThemeProvider + ServicePage   (storefront)
/admin                → AdminLayout (auth gate)
   index, services, categories, staff, work-hours, feedback,
   settings  (repurposed SettingsPage),  accounts  (new AdminUsersPage)
/admin (index, no session) → AdminLogin
redirects: /store, /adminmanager, /superadmin, /:slug  →  `/` or `/admin`
* → 404
```
Remove `BusinessBySlug()` (L28-37) and PlatformHome route.

**Pages**
- Delete: `pages/PlatformHome.jsx`, `pages/superadmin/*` (4 files), `pages/StorePage.jsx` (orphaned).
- `pages/admin/AdminLogin.jsx` — username + password → `authLogin`; no `business_id`.
- `pages/admin/AdminLayout.jsx` — remove `NoBusiness()`, `bizParam` (`?business=`) links (L55-59);
  sidebar adds **Settings** + **Accounts**; logout clears token.
- `pages/admin/SettingsPage.jsx` (currently orphaned + superadmin-gated) — wire at `/admin/settings`,
  save via `PUT /api/clinic` with the ordinary staff token; remove `useSuperAdmin`/`saToken` gating,
  retitle "Clinic Settings".
- New `pages/admin/AccountsPage.jsx` — owner-only CRUD of admin accounts.
- Admin pages (`Dashboard, ServicesPage, CategoriesPage, StaffPage, WorkHoursPage, FeedbackPage`) —
  drop `businessId` from all `useBusiness()` / API calls.
- `components/public/{Header,Navigation,Footer,WorkHoursSection,FeedbackForm}.jsx` — drop `businessId`
  props and `?business=` links (Header L23/35, Navigation L181, Footer L93).

**Branding**
- `frontend/index.html` — title "Vision Eye Clinic", description, favicon.
- `hooks/useSEO.js` — title suffix `| Vision Eye Clinic`, JSON-LD for a **MedicalClinic**.
- `utils/images.js` — remove the 6 per-tenant fallback maps; eye-care defaults.
- Delete `frontend/public/images/{savory-bites-restaurant, refined-grooming-lounge,
  brightcare-dental-clinic, elevate-events-and-fitness, linguabridge-tutoring,
  lens-and-light-photography}` (keep `hero.jpg` as temporary hero).
- Root `package.json` / `README.md` / `DEPLOYMENT.md` — rebrand, remove plaintext credentials
  (`DEPLOYMENT.md` L196-198, L730-734), document new schema + auth.

## Phase 4 — Seed (placeholder content)

Rewrite `backend/seed.js` (currently 673 lines / 6 demo sectors):
- One `clinic_settings` row: **Vision Eye Clinic**, tagline/about/phone/address/map placeholders,
  eye-care palette (e.g. primary `#0e7490` teal, secondary `#2563eb`, tertiary `#0891b2`).
- `work_hours`: Mon–Sat 08:00–17:00 open, Sunday closed.
- Categories: Eye Examination · Cataract & Glaucoma · Pediatric Eye Care · Eyewear & Contact Lenses · Eye Surgery.
- ~10 services with plausible ETB prices/durations; 4 placeholder staff; 2 approved testimonials.
- **Owner admin account** from `ADMIN_USERNAME`/`ADMIN_PASSWORD` env (bcrypt-hashed); print the
  generated credentials once if unset.
- Rewrite/trim `backend/migrate-add-is_special.js` (drop the 6-subdomain map, L26-33).

## Phase 5 — Config & verification

- `backend/.env.example` (+ `.env`): add `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`;
  keep `ALLOWED_ORIGINS` tight. Flag that `DATABASE_URL` / `SUPABASE_SERVICE_KEY` are committed in this
  working copy and should be rotated.
- Verify:
  1. `node --check` every backend file; `node backend/seed.js` against Supabase.
  2. `npm run build` (frontend) — must pass with no unused-import errors.
  3. Smoke test with server running: public `GET /api/clinic` + `GET /api/services` → 200;
     unauthenticated `POST /api/services` → **401**; wrong login → 403; `/api/debug` → 404;
     CORS from a non-allowlisted origin → blocked.
  4. Manual: `/` renders Vision Eye Clinic storefront; `/admin` login → services CRUD → settings save.

## Out of scope / notes
- Reservations remain click-to-call logging (no booking engine exists today).
- No TypeScript, no test framework in repo — verification is build + smoke tests above.
