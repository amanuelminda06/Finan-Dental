/*
  Every tenantId was verified non-NULL on the seeded local database before
  this migration was generated. If a deploy has rows written by older code,
  re-run the expand backfill first or this fails on the first NULL.

  Warnings:

  - Made the column `tenantId` on table `Appointment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Audience` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `AuditLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Campaign` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `CampaignBatch` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Feedback` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `FollowUp` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `LeaveRequest` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `MessageDraft` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `MessageLibraryItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `MessageTask` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `MessageTemplate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Patient` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `PatientSickLeave` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `PatientTag` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `ReceiptCounter` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Sale` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `SaleLine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Service` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `ServicePriceHistory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Setting` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Shift` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `ShiftTemplate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `SiteContent` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Staff` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `StoredFile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Tag` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Audience" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CampaignBatch" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Feedback" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "FollowUp" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "LeaveRequest" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MessageDraft" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MessageLibraryItem" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MessageTask" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MessageTemplate" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PatientSickLeave" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PatientTag" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ReceiptCounter" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Sale" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SaleLine" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ServicePriceHistory" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Setting" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Shift" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ShiftTemplate" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SiteContent" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Staff" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StoredFile" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Tag" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
