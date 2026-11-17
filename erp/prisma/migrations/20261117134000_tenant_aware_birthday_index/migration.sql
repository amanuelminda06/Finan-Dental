-- Replace the table-wide birthday expression index with a tenant-aware one.
-- The application filters patients by tenantId and (month, day) in memory, so
-- the leading tenantId column keeps the index useful per tenant.
DROP INDEX IF EXISTS "Patient_birthday_md_idx";

CREATE INDEX "Patient_tenantId_birthday_md_idx" ON "Patient" (
  "tenantId",
  (EXTRACT(MONTH FROM "birthDate") * 100 + EXTRACT(DAY FROM "birthDate"))
);
