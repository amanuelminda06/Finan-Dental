#!/bin/bash
# Smoke test against http://localhost:3100 (local embedded Postgres only).
# Every clinic owns a URL tree: /[tenant] (public), /[tenant]/erp (ERP),
# /[tenant]/api (APIs). This script exercises the default tenant and verifies
# that a session for it cannot cross into a second seeded tenant.
# Note: with cacheComponents the status line is committed before the page's
# dynamic pass runs, so post-login redirects arrive as NEXT_REDIRECT digests
# in the RSC flight payload (client-side), not as HTTP 307s. Unauthenticated
# redirects (from the layout gate) are still HTTP 307s.
set -u
cd "$(dirname "$0")/.."
BASE=http://localhost:3100
TENANT_SLUG=$(grep "^DEFAULT_TENANT_SLUG=" .env | cut -d= -f2- | tr -d '\"')
[ -n "$TENANT_SLUG" ] || TENANT_SLUG=finandentalclinic
SECOND_TENANT=$(grep "^E2E_SECOND_TENANT=" .env | cut -d= -f2- | tr -d '\"')
[ -n "$SECOND_TENANT" ] || SECOND_TENANT=bright-dental
TENANT_PATH=/$TENANT_SLUG
APP_PATH=$TENANT_PATH/erp
PUB=$BASE$TENANT_PATH           # public site
APP=$BASE$APP_PATH              # ERP pages
API=$PUB/api                    # tenant APIs
SECOND_PUB=$BASE/$SECOND_TENANT
SECOND_APP=$SECOND_PUB/erp
SECOND_API=$SECOND_PUB/api

# Safety: never let the smoke test's Prisma calls reach a hosted database.
# Node does not load .env on its own, so read the same URL the app uses (an
# explicit environment variable still wins for CI).
DB_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env | cut -d= -f2- | tr -d '\"')}
[ -n "$DB_URL" ] || { echo "DATABASE_URL not set (check .env)"; exit 1; }
DB_TARGET=$(DB_URL="$DB_URL" node -e "const u=new URL(process.env.DB_URL); console.log([u.hostname,u.port||'5432',u.pathname.slice(1)].join(' '))")
read -r DB_HOST DB_PORT DB_NAME <<<"$DB_TARGET"
case "$DB_HOST" in
  127.0.0.1|localhost|::1) ;;
  *) echo "Refusing to run smoke against non-local database host: ${DB_HOST:-<unset>}"; exit 1 ;;
esac
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"

# Provision the isolation tenants through the same CLI used in production docs.
# The script refuses hosted databases and never prints a secret or password.
npx tsx scripts/seed-e2e-tenants.ts > /tmp/opencode/e2e-seed.log 2>&1 || {
  cat /tmp/opencode/e2e-seed.log; exit 1;
}
SNAPSHOT=${E2E_TENANT_SNAPSHOT:-/tmp/opencode/erp-e2e-tenants.json}
[ -f "$SNAPSHOT" ] || { echo "Missing tenant snapshot: $SNAPSHOT"; exit 1; }
snap() { # snap <tenant slug> <dotted field>
  SNAPSHOT="$SNAPSHOT" node --input-type=module -e "
import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(process.env.SNAPSHOT, 'utf8'));
const value = process.argv[2].split('.').reduce((o, k) => o?.[k], s.tenants[process.argv[1]]);
process.stdout.write(value == null ? '' : String(value));" "$1" "$2";
}

# Fixed trial logins — the login field accepts these short names. No .env.
OWNER_LOGIN=owner; OWNER_PASSWORD=owner123
RECEPTION_LOGIN=reception; RECEPTION_PASSWORD=reception123
STAFF_LOGIN=doctor; STAFF_PASSWORD=doctor123
PASS=0; FAIL=0

check() { # check <desc> <expected> <actual>
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✓ $1";
  else FAIL=$((FAIL+1)); echo "✗ $1 (expected: $2, got: $3)"; fi
}
contains() { # contains <desc> <needle> <file>
  if grep -qi -- "$2" "$3"; then PASS=$((PASS+1)); echo "✓ $1";
  else FAIL=$((FAIL+1)); echo "✗ $1 (missing: $2)"; fi
}
login() { # login <jar> <email> <password>
  local jar=$1 email=$2 password=$3
  local token
  token=$(curl -s -c "$jar" "$API/auth/csrf" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
  curl -s -b "$jar" -c "$jar" -o /dev/null -X POST "$API/auth/callback/credentials" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "csrfToken=$token" \
    --data-urlencode "email=$email" \
    --data-urlencode "password=$password" \
    --data-urlencode "json=true"
}
has_session() { grep -q "session-token" "$1"; }
sql() { node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
$1
await p.\$disconnect();"; }

# Restore the documented local test login before each smoke section so the
# script is repeatable regardless of what earlier checks changed.
reset_login_user() { # reset_login_user <role> <password>
  ROLE="$1" PASSWORD="$2" TENANT_ID="$TENANT_ID" node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
const p = new PrismaClient();
await p.user.updateMany({
  where: { tenantId: process.env.TENANT_ID, role: process.env.ROLE },
  data: {
    passwordHash: await hash(process.env.PASSWORD),
    failedLoginCount: 0,
    lockedUntil: null,
  },
});
await p.\$disconnect();"; }

TENANT_ID=$(sql "const t = await p.tenant.findUnique({ where: { slug: '$TENANT_SLUG' }, select: { id: true } }); console.log(t ? t.id : '');")
[ -n "$TENANT_ID" ] || { echo "Tenant '$TENANT_SLUG' not found — seed the local DB first"; exit 1; }

user_id() { # user_id <role>
  sql "const u = await p.user.findFirst({ where: { tenantId: '$TENANT_ID', role: '$1' }, select: { id: true } }); console.log(u ? u.id : '');"
}
RECEPTION_UID=$(user_id RECEPTION)
STAFF_UID=$(user_id STAFF)
[ -n "$RECEPTION_UID" ] && [ -n "$STAFF_UID" ] || { echo 'Seeded reception/staff users not found'; exit 1; }

rm -f /tmp/opencode/erp-smoke*.jar /tmp/opencode/*.html /tmp/opencode/*.headers /tmp/opencode/audit.csv /tmp/opencode/tenant-*.xml /tmp/opencode/tenant-*.txt

# 1. Open login gate
code=$(curl -s -o /dev/null -w '%{http_code}' "$APP/login/totally-wrong")
check "login path suffix → 404" 404 "$code"
code=$(curl -s -o /tmp/opencode/login.html -w '%{http_code}' "$APP/login")
check "open ERP login page → 200" 200 "$code"
contains "login page renders" "password" /tmp/opencode/login.html

# 2. Security headers
curl -s -D /tmp/opencode/login.headers -o /dev/null "$APP/login"
contains "CSP header" "content-security-policy" /tmp/opencode/login.headers
contains "X-Frame-Options DENY" "x-frame-options: DENY" /tmp/opencode/login.headers
contains "nosniff" "x-content-type-options: nosniff" /tmp/opencode/login.headers
contains "Referrer-Policy" "referrer-policy" /tmp/opencode/login.headers

# 3. Bare root sends visitors to the tenantless platform login; ERP routes go to the open login page
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")
check "no session / → 307" 307 "$code"
loc=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/")
case "$loc" in */superadmin*) PASS=$((PASS+1)); echo "✓ root redirects to platform login";;
  *) FAIL=$((FAIL+1)); echo "✗ root redirect target: $loc";; esac
code=$(curl -s -o /tmp/opencode/superadmin.html -w '%{http_code}' "$BASE/superadmin")
check "platform login page → 200" 200 "$code"
contains "platform login renders" "Superadmin sign in" /tmp/opencode/superadmin.html
code=$(curl -s -o /dev/null -w '%{http_code}' "$APP/users")
check "no session /erp/users → 307" 307 "$code"
loc=$(curl -s -o /dev/null -w '%{redirect_url}' "$APP/users")
case "$loc" in *"/erp/login"*) PASS=$((PASS+1)); echo "✓ ERP redirect target is open login";;
  *) FAIL=$((FAIL+1)); echo "✗ ERP redirect target: $loc";; esac

# 4. Owner login + pages
JAR=/tmp/opencode/erp-smoke.jar
login "$JAR" $OWNER_LOGIN "$OWNER_PASSWORD"
if has_session "$JAR"; then PASS=$((PASS+1)); echo "✓ owner login sets session"; else FAIL=$((FAIL+1)); echo "✗ owner login: no session cookie"; fi
code=$(curl -s -b "$JAR" -o /tmp/opencode/users.html -w '%{http_code}' "$APP/users")
check "owner /users → 200" 200 "$code"
contains "users page title" "Users" /tmp/opencode/users.html
contains "users table has rows" "/users/cm" /tmp/opencode/users.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/audit.html -w '%{http_code}' "$APP/audit")
check "owner /audit → 200" 200 "$code"
contains "audit page renders" "Audit" /tmp/opencode/audit.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/settings.html -w '%{http_code}' "$APP/settings")
check "owner /settings → 200" 200 "$code"
contains "settings timezone field" "Africa/Addis_Ababa" /tmp/opencode/settings.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/branding.html -w '%{http_code}' "$APP/branding")
check "owner /branding → 200" 200 "$code"
contains "OWNER branding form renders" "Clinic branding" /tmp/opencode/branding.html

# 5. Owner CSV export
code=$(curl -s -b "$JAR" -o /tmp/opencode/audit.csv -w '%{http_code}' "$API/audit/export")
check "CSV export → 200" 200 "$code"
contains "CSV has BOM + header" "time,user,email,entity" /tmp/opencode/audit.csv
contains "CSV contains LOGIN_SUCCESS" "LOGIN_SUCCESS" /tmp/opencode/audit.csv

# 6. Uploads require a session
code=$(curl -s -o /dev/null -w '%{http_code}' "$API/uploads/staff-nope.png")
check "upload without session → 404" 404 "$code"
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$API/uploads/staff-nope.png")
check "upload missing file → 404" 404 "$code"
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$API/uploads/..%2F..%2Fetc%2Fpasswd")
check "traversal key → 404" 404 "$code"

# 7. Reception: role gate sends owner-only pages to /403 (no forced change)
reset_login_user RECEPTION "$RECEPTION_PASSWORD"
JAR2=/tmp/opencode/erp-smoke2.jar
login "$JAR2" $RECEPTION_LOGIN "$RECEPTION_PASSWORD"
if has_session "$JAR2"; then PASS=$((PASS+1)); echo "✓ reception login sets session"; else FAIL=$((FAIL+1)); echo "✗ reception login: no session cookie"; fi
code=$(curl -s -b "$JAR2" -o /tmp/opencode/rec-users.html -w '%{http_code}' "$APP/users")
check "reception /users → 200 (flight redirect)" 200 "$code"
contains "reception forbidden redirect" "NEXT_REDIRECT;replace;$APP_PATH/403" /tmp/opencode/rec-users.html
if grep -q "owner@finandental" /tmp/opencode/rec-users.html; then FAIL=$((FAIL+1)); echo "✗ reception /users leaks owner rows"; else PASS=$((PASS+1)); echo "✓ reception /users leaks no data"; fi
code=$(curl -s -b "$JAR2" -o /tmp/opencode/403.html -w '%{http_code}' "$APP/403")
check "/403 renders → 200" 200 "$code"
contains "403 content" "403" /tmp/opencode/403.html

# 8. Staff: dashboard opens directly (password change is voluntary)
reset_login_user STAFF "$STAFF_PASSWORD"
JAR3=/tmp/opencode/erp-smoke3.jar
login "$JAR3" $STAFF_LOGIN "$STAFF_PASSWORD"
if has_session "$JAR3"; then PASS=$((PASS+1)); echo "✓ staff login sets session"; else FAIL=$((FAIL+1)); echo "✗ staff login: no session cookie"; fi
code=$(curl -s -b "$JAR3" -o /tmp/opencode/staff-home.html -w '%{http_code}' "$APP/dashboard")
check "staff /dashboard → 200" 200 "$code"
contains "staff dashboard renders" "Dashboard" /tmp/opencode/staff-home.html
if grep -q "NEXT_REDIRECT;replace;$APP_PATH/change-password" /tmp/opencode/staff-home.html; then FAIL=$((FAIL+1)); echo "✗ staff hit a forced-change redirect"; else PASS=$((PASS+1)); echo "✓ no forced-change redirect"; fi
code=$(curl -s -b "$JAR3" -o /tmp/opencode/chpw.html -w '%{http_code}' "$APP/change-password")
check "/change-password renders → 200" 200 "$code"
contains "change password form" "newPassword" /tmp/opencode/chpw.html

# 9. Lockout after 5 failed attempts (fresh jar → no session until success)
JAR4=/tmp/opencode/erp-smoke4.jar
for i in 1 2 3 4 5; do
  login "$JAR4" $STAFF_LOGIN "definitely-wrong-$i"
done
if has_session "$JAR4"; then FAIL=$((FAIL+1)); echo "✗ wrong passwords must not set session"; else PASS=$((PASS+1)); echo "✓ wrong passwords set no session"; fi
state=$(sql "const u = await p.user.findUnique({ where: { id: '$STAFF_UID' }, select: { failedLoginCount: true, lockedUntil: true } }); console.log(u.failedLoginCount + ':' + (u.lockedUntil ? 'locked' : 'open'));")
check "5 failures counted + locked" "5:locked" "$state"
login "$JAR4" $STAFF_LOGIN "$STAFF_PASSWORD"
if has_session "$JAR4"; then FAIL=$((FAIL+1)); echo "✗ correct password rejected while locked"; else PASS=$((PASS+1)); echo "✓ correct password rejected while locked"; fi

# 10. Patients module (list, search, detail + VIEW audit, export, role gate)
code=$(curl -s -b "$JAR" -o /tmp/opencode/patients.html -w '%{http_code}' "$APP/patients")
check "owner /patients → 200" 200 "$code"
contains "patients list title" "Patients" /tmp/opencode/patients.html
contains "seed patient row" "Demo Patient One" /tmp/opencode/patients.html
contains "patient detail link" "/patients/c" /tmp/opencode/patients.html

code=$(curl -s -b "$JAR" -o /tmp/opencode/patients-q.html -w '%{http_code}' "$APP/patients?q=0900000001")
check "phone search → 200" 200 "$code"
contains "phone search finds the patient" "Demo Patient One" /tmp/opencode/patients-q.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/patients-none.html -w '%{http_code}' "$APP/patients?q=zzzz-no-match")
check "empty search → 200" 200 "$code"
contains "empty search state" "No results found" /tmp/opencode/patients-none.html

PID=$(sql "const row = await p.patient.findUnique({ where: { tenantId_phoneE164: { tenantId: '$TENANT_ID', phoneE164: '+251900000001' } }, select: { id: true } }); console.log(row.id);")
code=$(curl -s -b "$JAR" -o /tmp/opencode/patient.html -w '%{http_code}' "$APP/patients/$PID")
check "owner patient detail → 200" 200 "$code"
contains "tap-to-call shows stored E.164" "+251900000001" /tmp/opencode/patient.html
contains "non-clinical notes hint" "Non-clinical notes only" /tmp/opencode/patient.html
contains "consent block" "SMS consent" /tmp/opencode/patient.html
VIEW=$(sql "const n = await p.auditLog.count({ where: { entity: 'Patient', entityId: '$PID', action: 'VIEW' } }); console.log(String(n));")
if [ "$VIEW" -ge 1 ]; then PASS=$((PASS+1)); echo "✓ detail page writes VIEW audit ($VIEW)";
else FAIL=$((FAIL+1)); echo "✗ detail page wrote no VIEW audit"; fi

code=$(curl -s -b "$JAR" -o /tmp/opencode/patients.csv -w '%{http_code}' "$API/patients/export")
check "patients CSV export → 200" 200 "$code"
contains "CSV header" "id,fullName,phone,sex,birthDate,preferredLanguage" /tmp/opencode/patients.csv
rows=$(grep -c "251" /tmp/opencode/patients.csv)
check "CSV has 20 patient rows" 20 "$rows"
code=$(curl -s -b "$JAR" -o /tmp/opencode/patients-consent.csv -w '%{http_code}' "$API/patients/export?consent=true")
check "filtered CSV export → 200" 200 "$code"
rows=$(grep -c "251" /tmp/opencode/patients-consent.csv)
check "consent filter → 11 rows" 11 "$rows"
code=$(curl -s -b "$JAR" -o /tmp/opencode/template.csv -w '%{http_code}' "$API/patients/template")
check "import template → 200" 200 "$code"
contains "template columns" "fullName,phone,sex,birthDate,tags,consent,preferredLanguage" /tmp/opencode/template.csv
code=$(curl -s -o /dev/null -w '%{http_code}' "$API/patients/export")
check "export without session → 307 to login" 307 "$code"

# STAFF must be denied the patients module (clear the lockout from section 9 first)
sql "await p.user.update({ where: { id: '$STAFF_UID' }, data: { failedLoginCount: 0, lockedUntil: null } }); console.log('ok');"
JAR5=/tmp/opencode/erp-smoke5.jar
login "$JAR5" $STAFF_LOGIN "$STAFF_PASSWORD"
code=$(curl -s -b "$JAR5" -o /tmp/opencode/staff-patients.html -w '%{http_code}' "$APP/patients")
check "staff /patients → 200 (flight redirect)" 200 "$code"
contains "staff /patients forbidden" "NEXT_REDIRECT;replace;$APP_PATH/403" /tmp/opencode/staff-patients.html
code=$(curl -s -b "$JAR5" -o /dev/null -w '%{http_code}' "$API/patients/export")
check "staff CSV export → 403" 403 "$code"

# 11. Services + Sales + Revenue
code=$(curl -s -b "$JAR" -o /tmp/opencode/services.html -w '%{http_code}' "$APP/dashboard/services")
check "owner /dashboard/services → 200" 200 "$code"
contains "services list title" "Services" /tmp/opencode/services.html
contains "seeded service row" "Free Consultation" /tmp/opencode/services.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/services-new.html -w '%{http_code}' "$APP/dashboard/services/new")
check "owner /dashboard/services/new → 200" 200 "$code"
contains "new service form" "Choose a category" /tmp/opencode/services-new.html

code=$(curl -s -b "$JAR" -o /tmp/opencode/sales.html -w '%{http_code}' "$APP/sales")
check "owner /sales → 200" 200 "$code"
contains "sales list has receipts" "2026-0000" /tmp/opencode/sales.html
contains "sales list has total" "Total" /tmp/opencode/sales.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/sales-new.html -w '%{http_code}' "$APP/sales/new")
check "owner /sales/new → 200" 200 "$code"
contains "new sale confirm button" "Confirm sale" /tmp/opencode/sales-new.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/voids.html -w '%{http_code}' "$APP/sales/voids")
check "owner /sales/voids → 200" 200 "$code"

SALEID=$(sql "const row = await p.sale.findFirst({ where: { status: 'CONFIRMED' }, orderBy: { saleDate: 'desc' }, select: { id: true } }); console.log(row.id);")
code=$(curl -s -b "$JAR" -o /tmp/opencode/sale.html -w '%{http_code}' "$APP/sales/$SALEID")
check "owner sale detail → 200" 200 "$code"
contains "sale receipt renders" "Sales receipt" /tmp/opencode/sale.html
contains "sale audit trail" "Sale created" /tmp/opencode/sale.html

code=$(curl -s -b "$JAR" -o /tmp/opencode/revenue.html -w '%{http_code}' "$APP/revenue")
check "owner /revenue → 200" 200 "$code"
contains "revenue total card" "Total revenue" /tmp/opencode/revenue.html
contains "revenue breakdown" "By service" /tmp/opencode/revenue.html

code=$(curl -s -b "$JAR" -o /tmp/opencode/sales.csv -w '%{http_code}' "$API/sales/export")
check "owner sales CSV export → 200" 200 "$code"
contains "sales CSV header" "receiptNumber,saleDate,patient" /tmp/opencode/sales.csv
code=$(curl -s -o /dev/null -w '%{http_code}' "$API/sales/export")
check "sales export without session → 307 to login" 307 "$code"

# Reception: may sell, but cannot see revenue or manage services
code=$(curl -s -b "$JAR2B" -o /tmp/opencode/rec-sales.html -w '%{http_code}' "$APP/sales")
check "reception /sales → 200" 200 "$code"
contains "reception sales empty (own, today)" "Nothing here yet" /tmp/opencode/rec-sales.html
if grep -q "2026-0000" /tmp/opencode/rec-sales.html; then FAIL=$((FAIL+1)); echo "✗ reception /sales leaks other sales"; else PASS=$((PASS+1)); echo "✓ reception /sales leaks no other sales"; fi
code=$(curl -s -b "$JAR2B" -o /tmp/opencode/rec-revenue.html -w '%{http_code}' "$APP/revenue")
check "reception /revenue → 200 (flight redirect)" 200 "$code"
contains "reception /revenue forbidden" "NEXT_REDIRECT;replace;$APP_PATH/403" /tmp/opencode/rec-revenue.html
code=$(curl -s -b "$JAR2B" -o /tmp/opencode/rec-services.html -w '%{http_code}' "$APP/dashboard/services")
check "reception /dashboard/services → 200 (flight redirect)" 200 "$code"
contains "reception /dashboard/services forbidden" "NEXT_REDIRECT;replace;$APP_PATH/403" /tmp/opencode/rec-services.html

# Staff: denied the whole sales module
code=$(curl -s -b "$JAR5" -o /tmp/opencode/staff-sales.html -w '%{http_code}' "$APP/sales")
check "staff /sales → 200 (flight redirect)" 200 "$code"
contains "staff /sales forbidden" "NEXT_REDIRECT;replace;$APP_PATH/403" /tmp/opencode/staff-sales.html
code=$(curl -s -b "$JAR5" -o /dev/null -w '%{http_code}' "$API/sales/export")
check "staff sales export → 403" 403 "$code"

# 11b. HR: schedule, leave, approvals, calendar, public on-duty feed
code=$(curl -s -b "$JAR" -o /tmp/opencode/hr-schedule.html -w '%{http_code}' "$APP/schedule")
check "owner /schedule → 200" 200 "$code"
contains "schedule shows owner controls" "Add shift" /tmp/opencode/hr-schedule.html
contains "schedule shows seeded shift" "Dr. Tigist Alemu" /tmp/opencode/hr-schedule.html

code=$(curl -s -b "$JAR" -o /tmp/opencode/hr-leave.html -w '%{http_code}' "$APP/leave")
check "owner /leave → 200" 200 "$code"
contains "leave page shows balance" "Annual leave balance" /tmp/opencode/hr-leave.html

code=$(curl -s -b "$JAR" -o /tmp/opencode/hr-inbox.html -w '%{http_code}' "$APP/leave/inbox")
check "owner /leave/inbox → 200" 200 "$code"
contains "approval inbox lists seed request" "Hanna Girma" /tmp/opencode/hr-inbox.html
contains "approval inbox has decision form" "Approve" /tmp/opencode/hr-inbox.html

code=$(curl -s -b "$JAR" -o /tmp/opencode/hr-cal.html -w '%{http_code}' "$APP/leave/calendar")
check "owner /leave/calendar → 200" 200 "$code"
contains "leave calendar shows approved leave" "Dr. Tigist Alemu" /tmp/opencode/hr-cal.html

code=$(curl -s -b "$JAR2B" -o /tmp/opencode/hr-rec-schedule.html -w '%{http_code}' "$APP/schedule")
check "reception /schedule → 200" 200 "$code"
contains "reception sees team schedule" "Dr. Tigist Alemu" /tmp/opencode/hr-rec-schedule.html
if grep -q "template-staff" /tmp/opencode/hr-rec-schedule.html; then FAIL=$((FAIL+1)); echo "✗ reception /schedule shows owner controls"; else PASS=$((PASS+1)); echo "✓ reception /schedule has no owner controls"; fi

code=$(curl -s -b "$JAR5" -o /tmp/opencode/hr-staff-schedule.html -w '%{http_code}' "$APP/schedule")
check "staff /schedule → 200" 200 "$code"
contains "staff sees own schedule" "Dr. Abebe Kebede" /tmp/opencode/hr-staff-schedule.html
if grep -q "Dr. Tigist Alemu" /tmp/opencode/hr-staff-schedule.html; then FAIL=$((FAIL+1)); echo "✗ staff /schedule leaks teammates"; else PASS=$((PASS+1)); echo "✓ staff /schedule hides teammates"; fi
code=$(curl -s -b "$JAR5" -o /tmp/opencode/hr-staff-inbox.html -w '%{http_code}' "$APP/leave/inbox")
check "staff /leave/inbox → 200 (flight redirect)" 200 "$code"
contains "staff approvals forbidden" "NEXT_REDIRECT;replace;$APP_PATH/403" /tmp/opencode/hr-staff-inbox.html

code=$(curl -s -o /tmp/opencode/public.html -w '%{http_code}' "$API/public/doctors")
check "public doctors feed → 200" 200 "$code"
contains "feed has doctors array" "\"doctors\"" /tmp/opencode/public.html
PUB_N=$(grep -o '"specialty"' /tmp/opencode/public.html | wc -l)
check "feed publishes 3 website doctors" 3 "$PUB_N"
if grep -q -e 'annualLeaveDays' -e 'jobTitle' -e '"email"' -e '"phone"' /tmp/opencode/public.html; then FAIL=$((FAIL+1)); echo "✗ public feed leaks private fields"; else PASS=$((PASS+1)); echo "✓ public feed leaks no private fields"; fi
curl -s -D /tmp/opencode/public.headers -o /dev/null "$API/public/doctors"
contains "public feed cached for 60s" "max-age=60" /tmp/opencode/public.headers

# 11c. Appointments, website bookings, follow-ups + public intake
code=$(curl -s -b "$JAR" -o /tmp/opencode/erpts.html -w '%{http_code}' "$APP/appointments")
check "owner /appointments → 200" 200 "$code"
contains "appointments title" "Appointments" /tmp/opencode/erpts.html
contains "appointments list shows patient" "Demo Patient One" /tmp/opencode/erpts.html
contains "appointments list shows doctor" "Dr. Tigist Alemu" /tmp/opencode/erpts.html
contains "appointments has new button" "New appointment" /tmp/opencode/erpts.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/erpts-week.html -w '%{http_code}' "$APP/appointments?view=week")
check "owner /appointments?view=week → 200" 200 "$code"
contains "week view renders patient" "Demo Patient One" /tmp/opencode/erpts-week.html

code=$(curl -s -b "$JAR" -o /tmp/opencode/fups.html -w '%{http_code}' "$APP/follow-ups")
check "owner /follow-ups → 200" 200 "$code"
contains "follow-ups title" "Follow-ups" /tmp/opencode/fups.html
contains "follow-ups lists open item" "Repeat eye test" /tmp/opencode/fups.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/fups-over.html -w '%{http_code}' "$APP/follow-ups?status=overdue")
check "owner /follow-ups?status=overdue → 200" 200 "$code"
contains "overdue tab lists overdue patient" "Demo Patient One" /tmp/opencode/fups-over.html
if grep -q "Contact lens review" /tmp/opencode/fups-over.html; then FAIL=$((FAIL+1)); echo "✗ overdue tab leaks future follow-up"; else PASS=$((PASS+1)); echo "✓ overdue tab hides future follow-up"; fi

# seeded demo counts
AC=$(sql "const n = await p.appointment.count({ where: { id: { startsWith: 'seed-appt-' } } }); console.log(String(n));")
check "seeded appointments = 20" 20 "$AC"
FC=$(sql "const n = await p.followUp.count({ where: { id: { startsWith: 'seed-followup-' } } }); console.log(String(n));")
check "seeded follow-ups = 5" 5 "$FC"

# public website booking intake (no session, no raw IP stored) — auto-approved
code=$(curl -s -o /tmp/opencode/pub-badjson.html -w '%{http_code}' -X POST "$API/public/requests" \
  -H 'Content-Type: application/json' -H "X-Forwarded-For: 10.0.0.11" --data 'not-json')
check "public booking invalid JSON → 400" 400 "$code"
code=$(curl -s -o /tmp/opencode/pub-bad.html -w '%{http_code}' -X POST "$API/public/requests" \
  -H 'Content-Type: application/json' -H "X-Forwarded-For: 10.0.0.12" \
  --data '{"name":"","phone":"nope"}')
check "public booking invalid fields → 422" 422 "$code"
contains "public booking reports validation error" "validationError" /tmp/opencode/pub-bad.html
code=$(curl -s -o /tmp/opencode/pub-ok.html -w '%{http_code}' -X POST "$API/public/requests" \
  -H 'Content-Type: application/json' -H "X-Forwarded-For: 10.0.0.13" \
  --data '{"name":"Smoke Test","phone":"0911000001","preferredDate":"2027-01-05","language":"en"}')
check "public booking valid → 200" 200 "$code"
contains "public booking returns ok" "\"ok\":true" /tmp/opencode/pub-ok.html
contains "public booking names the slot" "\"appointment\"" /tmp/opencode/pub-ok.html
BOOKED=$(sql "const row = await p.appointment.findFirst({ where: { tenantId: '$TENANT_ID', patient: { tenantId: '$TENANT_ID', phoneE164: '+251911000001' }, createdFrom: 'WEBSITE_REQUEST' }, select: { status: true, createdBy: true, doctorId: true } }); console.log(row ? row.status + ':' + row.createdBy + ':' + (row.doctorId ? 'doctor' : 'none') : 'missing');")
check "public booking auto-created a CONFIRMED appointment" "CONFIRMED:public-booking:doctor" "$BOOKED"
sql "const rows = await p.patient.findMany({ where: { tenantId: '$TENANT_ID', phoneE164: '+251911000001' }, select: { id: true } }); const ids = rows.map(r => r.id); await p.messageTask.deleteMany({ where: { patientId: { in: ids } } }); await p.appointment.deleteMany({ where: { patientId: { in: ids } } }); await p.patient.deleteMany({ where: { id: { in: ids } } }); console.log('cleaned');"

# role gates: reception may view, staff is denied
code=$(curl -s -b "$JAR2B" -o /tmp/opencode/rec-fups.html -w '%{http_code}' "$APP/follow-ups")
check "reception /follow-ups → 200" 200 "$code"
contains "reception sees follow-ups" "Demo Patient One" /tmp/opencode/rec-fups.html
code=$(curl -s -b "$JAR2B" -o /tmp/opencode/rec-appts.html -w '%{http_code}' "$APP/appointments")
check "reception /appointments → 200" 200 "$code"
code=$(curl -s -b "$JAR5" -o /tmp/opencode/staff-appts.html -w '%{http_code}' "$APP/appointments")
check "staff /appointments → 200 (flight redirect)" 200 "$code"
contains "staff /appointments forbidden" "NEXT_REDIRECT;replace;$APP_PATH/403" /tmp/opencode/staff-appts.html
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$APP/requests")
check "removed /requests → 404" 404 "$code"

# 11d. Messaging: outbox, templates, campaigns, reports, count API + job gate
code=$(curl -s -b "$JAR" -o /tmp/opencode/messages.html -w '%{http_code}' "$APP/messages")
check "owner /messages → 200" 200 "$code"
contains "messages title" "Today's Messages" /tmp/opencode/messages.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/msg-templates.html -w '%{http_code}' "$APP/messages/templates")
check "owner /messages/templates → 200" 200 "$code"
contains "templates title" "Message templates" /tmp/opencode/msg-templates.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/msg-campaigns.html -w '%{http_code}' "$APP/messages/campaigns")
check "owner /messages/campaigns → 200" 200 "$code"
contains "campaigns title" "Campaigns" /tmp/opencode/msg-campaigns.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/msg-new.html -w '%{http_code}' "$APP/messages/campaigns/new")
check "owner /messages/campaigns/new → 200" 200 "$code"
contains "new campaign title" "New campaign" /tmp/opencode/msg-new.html
code=$(curl -s -b "$JAR" -o /tmp/opencode/msg-reports.html -w '%{http_code}' "$APP/messages/reports")
check "owner /messages/reports → 200" 200 "$code"
contains "reports title" "not sent by deadline" /tmp/opencode/msg-reports.html

TC=$(sql "const n = await p.messageTemplate.count(); console.log(String(n));")
check "seeded message templates = 26" 26 "$TC"

# count API is session-gated
code=$(curl -s -b "$JAR" -o /tmp/opencode/msg-count.html -w '%{http_code}' "$API/messages/count")
check "owner message count API → 200" 200 "$code"
contains "count API returns ok" "\"ok\":true" /tmp/opencode/msg-count.html
code=$(curl -s -o /dev/null -w '%{http_code}' "$API/messages/count")
check "count API without session → 401" 401 "$code"

# job endpoint requires a bearer secret (disabled when CRON_SECRET is unset)
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/jobs/messages")
CRON=$(grep "^CRON_SECRET=" .env | cut -d= -f2- | tr -d '"')
if [ -z "$CRON" ]; then check "job endpoint disabled without secret → 503" 503 "$code";
else check "job endpoint rejects missing bearer → 401" 401 "$code"; fi

# reception may use messaging; staff is denied
code=$(curl -s -b "$JAR2B" -o /tmp/opencode/rec-messages.html -w '%{http_code}' "$APP/messages")
check "reception /messages → 200" 200 "$code"
code=$(curl -s -b "$JAR5" -o /tmp/opencode/staff-messages.html -w '%{http_code}' "$APP/messages")
check "staff /messages → 200 (flight redirect)" 200 "$code"
contains "staff /messages forbidden" "NEXT_REDIRECT;replace;$APP_PATH/403" /tmp/opencode/staff-messages.html

# 11e. Cross-tenant sessions: B's public site is viewable, B's data is not.
# Owner jar is bound to tenant A; B's public pages/assets must render B while
# its ERP, APIs and uploads reject A's session with 404.
code=$(curl -s -b "$JAR" -o /tmp/opencode/tenant-b-foreign-home.html -w '%{http_code}' "$SECOND_PUB")
check "tenant-A session on B public home → 200" 200 "$code"
contains "B home renders B with A's session" "$(snap "$SECOND_TENANT" clinicName)" /tmp/opencode/tenant-b-foreign-home.html
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$SECOND_PUB/about")
check "tenant-A session on B public page → 200" 200 "$code"
B_FOREIGN_HERO=$(snap "$SECOND_TENANT" heroUrl)
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$SECOND_PUB$B_FOREIGN_HERO")
check "tenant-A session on B public asset → 200" 200 "$code"
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$SECOND_APP/login")
check "tenant-A session on B login → 200" 200 "$code"
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$SECOND_APP/patients")
check "tenant-A session on B /erp/patients → 404" 404 "$code"
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$SECOND_API/patients/export")
check "tenant-A session on B API → 404" 404 "$code"
code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$SECOND_API/uploads/staff-nope.png")
check "tenant-A session on B upload → 404" 404 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$SECOND_PUB/about")
check "anonymous B public page → 200" 200 "$code"

# SEO files are per tenant and never list another clinic's URLs.
code=$(curl -s -o /tmp/opencode/tenant-a-sitemap.xml -w '%{http_code}' "$PUB/sitemap.xml")
check "tenant A sitemap → 200" 200 "$code"
contains "A sitemap lists A" "/$TENANT_SLUG/about" /tmp/opencode/tenant-a-sitemap.xml
if grep -q "/$SECOND_TENANT/" /tmp/opencode/tenant-a-sitemap.xml; then FAIL=$((FAIL+1)); echo "✗ A sitemap leaks B"; else PASS=$((PASS+1)); echo "✓ A sitemap leaks no B URLs"; fi
code=$(curl -s -o /tmp/opencode/tenant-b-sitemap.xml -w '%{http_code}' "$SECOND_PUB/sitemap.xml")
check "tenant B sitemap → 200" 200 "$code"
contains "B sitemap lists B" "/$SECOND_TENANT/about" /tmp/opencode/tenant-b-sitemap.xml
if grep -q "/$TENANT_SLUG/" /tmp/opencode/tenant-b-sitemap.xml; then FAIL=$((FAIL+1)); echo "✗ B sitemap leaks A"; else PASS=$((PASS+1)); echo "✓ B sitemap leaks no A URLs"; fi
code=$(curl -s -o /tmp/opencode/tenant-b-robots.txt -w '%{http_code}' "$SECOND_PUB/robots.txt")
check "tenant B robots → 200" 200 "$code"
contains "B robots sitemap scoped" "/$SECOND_TENANT/sitemap.xml" /tmp/opencode/tenant-b-robots.txt

# 11f. Per-tenant branding, tenant-owned images and rendered message text
A_CLINIC=$(snap "$TENANT_SLUG" clinicName)
B_CLINIC=$(snap "$SECOND_TENANT" clinicName)
A_ID=$(snap "$TENANT_SLUG" id)
B_ID=$(snap "$SECOND_TENANT" id)
A_PRIMARY=$(snap "$TENANT_SLUG" colors.primary)
B_PRIMARY=$(snap "$SECOND_TENANT" colors.primary)
A_HERO=$(snap "$TENANT_SLUG" heroUrl)
B_HERO=$(snap "$SECOND_TENANT" heroUrl)
A_SERVICE_IMAGE=$(snap "$TENANT_SLUG" serviceImageUrl)
B_SERVICE_IMAGE=$(snap "$SECOND_TENANT" serviceImageUrl)

code=$(curl -s -o /tmp/opencode/brand-home-a.html -w '%{http_code}' "$PUB")
check "branding: tenant A home → 200" 200 "$code"
code=$(curl -s -o /tmp/opencode/brand-home-b.html -w '%{http_code}' "$SECOND_PUB")
check "branding: tenant B home → 200" 200 "$code"
contains "A home shows A clinic" "$A_CLINIC" /tmp/opencode/brand-home-a.html
contains "B home shows B clinic" "$B_CLINIC" /tmp/opencode/brand-home-b.html
if grep -Fq "$B_CLINIC" /tmp/opencode/brand-home-a.html; then FAIL=$((FAIL+1)); echo "✗ A home leaks B clinic name"; else PASS=$((PASS+1)); echo "✓ A home leaks no B clinic name"; fi
if grep -Fq "$A_CLINIC" /tmp/opencode/brand-home-b.html; then FAIL=$((FAIL+1)); echo "✗ B home leaks A clinic name"; else PASS=$((PASS+1)); echo "✓ B home leaks no A clinic name"; fi
contains "A CSS brand colour" "--finan-brand-primary:$A_PRIMARY" /tmp/opencode/brand-home-a.html
contains "B CSS brand colour" "--finan-brand-primary:$B_PRIMARY" /tmp/opencode/brand-home-b.html
if [ "$A_PRIMARY" = "$B_PRIMARY" ]; then FAIL=$((FAIL+1)); echo "✗ tenants share a brand colour"; else PASS=$((PASS+1)); echo "✓ tenants have different brand colours"; fi

# Each clinic's hero/service images live in its own storage key and URL tree.
contains "A hero is tenant-owned" "$A_ID" /tmp/opencode/brand-home-a.html
contains "B hero is tenant-owned" "$B_ID" /tmp/opencode/brand-home-b.html
if grep -Fq "$B_ID" /tmp/opencode/brand-home-a.html; then FAIL=$((FAIL+1)); echo "✗ A home leaks B storage key"; else PASS=$((PASS+1)); echo "✓ A home leaks no B storage key"; fi
if grep -Fq "$A_ID" /tmp/opencode/brand-home-b.html; then FAIL=$((FAIL+1)); echo "✗ B home leaks A storage key"; else PASS=$((PASS+1)); echo "✓ B home leaks no A storage key"; fi
[ -n "$A_HERO" ] || { echo "Tenant A has no hero URL in snapshot"; exit 1; }
[ -n "$B_HERO" ] || { echo "Tenant B has no hero URL in snapshot"; exit 1; }
code=$(curl -s -o /tmp/opencode/hero-a.bin -w '%{http_code}' "$PUB$A_HERO")
check "A brand asset → 200" 200 "$code"
code=$(curl -s -o /tmp/opencode/hero-b.bin -w '%{http_code}' "$SECOND_PUB$B_HERO")
check "B brand asset → 200" 200 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$SECOND_PUB/api/public/assets/$A_ID/seed-hero.jpg")
check "A asset key under B URL → 404" 404 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$PUB/api/public/assets/$B_ID/seed-hero.jpg")
check "B asset key under A URL → 404" 404 "$code"

# Service rows are tenant-owned too: the second clinic renamed its starter service.
curl -s -o /tmp/opencode/brand-services-a.html "$PUB/services"
curl -s -o /tmp/opencode/brand-services-b.html "$SECOND_PUB/services"
contains "A services show A catalogue" "Free Consultation" /tmp/opencode/brand-services-a.html
contains "B services show B catalogue" "Bright Dental Whitening" /tmp/opencode/brand-services-b.html
if grep -Fq "Bright Dental Whitening" /tmp/opencode/brand-services-a.html; then FAIL=$((FAIL+1)); echo "✗ A services leak B service"; else PASS=$((PASS+1)); echo "✓ A services leak no B service"; fi
if grep -Fq "Free Consultation" /tmp/opencode/brand-services-b.html; then FAIL=$((FAIL+1)); echo "✗ B services leak A service"; else PASS=$((PASS+1)); echo "✓ B services leak no A service"; fi
case "$A_SERVICE_IMAGE" in *"/$A_ID/"*) PASS=$((PASS+1)); echo "✓ A service image is tenant-owned";; *) FAIL=$((FAIL+1)); echo "✗ A service image key: $A_SERVICE_IMAGE";; esac
case "$B_SERVICE_IMAGE" in *"/$B_ID/"*) PASS=$((PASS+1)); echo "✓ B service image is tenant-owned";; *) FAIL=$((FAIL+1)); echo "✗ B service image key: $B_SERVICE_IMAGE";; esac

# Rendered SMS/reminder text is produced from each tenant's own clinic name.
snap "$TENANT_SLUG" reminder > /tmp/opencode/reminder-a.txt
snap "$SECOND_TENANT" reminder > /tmp/opencode/reminder-b.txt
contains "A reminder uses A clinic" "$A_CLINIC" /tmp/opencode/reminder-a.txt
contains "B reminder uses B clinic" "$B_CLINIC" /tmp/opencode/reminder-b.txt
if grep -Fq "$B_CLINIC" /tmp/opencode/reminder-a.txt; then FAIL=$((FAIL+1)); echo "✗ A reminder leaks B clinic"; else PASS=$((PASS+1)); echo "✓ A reminder leaks no B clinic"; fi
if grep -Fq "$A_CLINIC" /tmp/opencode/reminder-b.txt; then FAIL=$((FAIL+1)); echo "✗ B reminder leaks A clinic"; else PASS=$((PASS+1)); echo "✓ B reminder leaks no A clinic"; fi
if cmp -s /tmp/opencode/reminder-a.txt /tmp/opencode/reminder-b.txt; then FAIL=$((FAIL+1)); echo "✗ tenants share identical reminder text"; else PASS=$((PASS+1)); echo "✓ reminder text differs per tenant"; fi

# 12. Cleanup + server still alive
sql "await p.user.update({ where: { id: '$STAFF_UID' }, data: { failedLoginCount: 0, lockedUntil: null } }); console.log('unlocked');"
if ss -ltn | grep -q ":3100"; then PASS=$((PASS+1)); echo "✓ server alive after full run"; else FAIL=$((FAIL+1)); echo "✗ server died during run"; fi

echo
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
