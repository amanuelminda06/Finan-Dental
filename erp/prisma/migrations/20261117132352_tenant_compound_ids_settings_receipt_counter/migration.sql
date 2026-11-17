/*
  Warnings:

  - The primary key for the `ReceiptCounter` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Setting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SiteContent` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropIndex
DROP INDEX "ReceiptCounter_tenantId_idx";

-- DropIndex
DROP INDEX "Setting_tenantId_idx";

-- DropIndex
DROP INDEX "SiteContent_tenantId_idx";

-- AlterTable
ALTER TABLE "ReceiptCounter" DROP CONSTRAINT "ReceiptCounter_pkey",
ADD CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY ("tenantId", "year");

-- AlterTable
ALTER TABLE "Setting" DROP CONSTRAINT "Setting_pkey",
ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("tenantId", "key");

-- AlterTable
ALTER TABLE "SiteContent" DROP CONSTRAINT "SiteContent_pkey",
ADD CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("tenantId", "key");
