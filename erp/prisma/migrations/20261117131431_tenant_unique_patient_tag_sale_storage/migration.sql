/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,phoneE164]` on the table `Patient` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,receiptNumber]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,key]` on the table `StoredFile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,name]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Patient_idNo_idx";

-- DropIndex
DROP INDEX "Patient_phoneE164_key";

-- DropIndex
DROP INDEX "Sale_receiptNumber_key";

-- DropConstraint (backed by a real UNIQUE constraint, not a standalone index)
ALTER TABLE "StoredFile" DROP CONSTRAINT "StoredFile_key_key";

-- DropIndex
DROP INDEX "Tag_name_key";

-- CreateIndex
CREATE INDEX "Patient_tenantId_idNo_idx" ON "Patient"("tenantId", "idNo");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_tenantId_phoneE164_key" ON "Patient"("tenantId", "phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_receiptNumber_key" ON "Sale"("tenantId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_tenantId_key_key" ON "StoredFile"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tenantId_name_key" ON "Tag"("tenantId", "name");
