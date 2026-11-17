-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Audience" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "CampaignBatch" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "MessageDraft" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "MessageLibraryItem" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "MessageTask" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PatientSickLeave" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PatientTag" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ReceiptCounter" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ServicePriceHistory" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ShiftTemplate" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "SiteContent" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMPTZ,
    "customDomain" TEXT,
    "loginSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_customDomain_key" ON "Tenant"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_loginSecret_key" ON "Tenant"("loginSecret");

-- Seed the single existing clinic. The login secret is a random placeholder
-- (never a real credential); scripts/set-tenant-login-secret.ts replaces it
-- with LOGIN_SECRET_PATH when the secret link is provisioned.
INSERT INTO "Tenant" ("id", "slug", "name", "status", "loginSecret", "createdAt", "updatedAt")
VALUES (
    'tenant_finan_0000000000000',
    'finan',
    'Finan Speciality Dental Clinic',
    'TRIAL',
    md5(random()::text || clock_timestamp()::text),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Appointment_tenantId_idx" ON "Appointment"("tenantId");

-- CreateIndex
CREATE INDEX "Audience_tenantId_idx" ON "Audience"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_idx" ON "Campaign"("tenantId");

-- CreateIndex
CREATE INDEX "CampaignBatch_tenantId_idx" ON "CampaignBatch"("tenantId");

-- CreateIndex
CREATE INDEX "Feedback_tenantId_idx" ON "Feedback"("tenantId");

-- CreateIndex
CREATE INDEX "FollowUp_tenantId_idx" ON "FollowUp"("tenantId");

-- CreateIndex
CREATE INDEX "LeaveRequest_tenantId_idx" ON "LeaveRequest"("tenantId");

-- CreateIndex
CREATE INDEX "MessageDraft_tenantId_idx" ON "MessageDraft"("tenantId");

-- CreateIndex
CREATE INDEX "MessageLibraryItem_tenantId_idx" ON "MessageLibraryItem"("tenantId");

-- CreateIndex
CREATE INDEX "MessageTask_tenantId_idx" ON "MessageTask"("tenantId");

-- CreateIndex
CREATE INDEX "MessageTemplate_tenantId_idx" ON "MessageTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "Patient_tenantId_idx" ON "Patient"("tenantId");

-- CreateIndex
CREATE INDEX "PatientSickLeave_tenantId_idx" ON "PatientSickLeave"("tenantId");

-- CreateIndex
CREATE INDEX "PatientTag_tenantId_idx" ON "PatientTag"("tenantId");

-- CreateIndex
CREATE INDEX "ReceiptCounter_tenantId_idx" ON "ReceiptCounter"("tenantId");

-- CreateIndex
CREATE INDEX "Sale_tenantId_idx" ON "Sale"("tenantId");

-- CreateIndex
CREATE INDEX "SaleLine_tenantId_idx" ON "SaleLine"("tenantId");

-- CreateIndex
CREATE INDEX "Service_tenantId_idx" ON "Service"("tenantId");

-- CreateIndex
CREATE INDEX "ServicePriceHistory_tenantId_idx" ON "ServicePriceHistory"("tenantId");

-- CreateIndex
CREATE INDEX "Setting_tenantId_idx" ON "Setting"("tenantId");

-- CreateIndex
CREATE INDEX "Shift_tenantId_idx" ON "Shift"("tenantId");

-- CreateIndex
CREATE INDEX "ShiftTemplate_tenantId_idx" ON "ShiftTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "SiteContent_tenantId_idx" ON "SiteContent"("tenantId");

-- CreateIndex
CREATE INDEX "Staff_tenantId_idx" ON "Staff"("tenantId");

-- CreateIndex
CREATE INDEX "StoredFile_tenantId_idx" ON "StoredFile"("tenantId");

-- CreateIndex
CREATE INDEX "Tag_tenantId_idx" ON "Tag"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteContent" ADD CONSTRAINT "SiteContent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientTag" ADD CONSTRAINT "PatientTag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSickLeave" ADD CONSTRAINT "PatientSickLeave_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePriceHistory" ADD CONSTRAINT "ServicePriceHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptCounter" ADD CONSTRAINT "ReceiptCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTask" ADD CONSTRAINT "MessageTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBatch" ADD CONSTRAINT "CampaignBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDraft" ADD CONSTRAINT "MessageDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLibraryItem" ADD CONSTRAINT "MessageLibraryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audience" ADD CONSTRAINT "Audience_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill every existing row with the one seeded tenant.
UPDATE "Appointment" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "Audience" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "AuditLog" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "Campaign" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "CampaignBatch" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "Feedback" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "FollowUp" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "LeaveRequest" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "MessageDraft" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "MessageLibraryItem" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "MessageTask" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "MessageTemplate" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "Patient" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "PatientSickLeave" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "PatientTag" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "ReceiptCounter" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "Sale" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "SaleLine" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "Service" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "ServicePriceHistory" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "Setting" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "Shift" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "ShiftTemplate" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "SiteContent" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "Staff" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "StoredFile" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "Tag" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
UPDATE "User" SET "tenantId" = 'tenant_finan_0000000000000' WHERE "tenantId" IS NULL;
