/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,normalizedHash,language]` on the table `MessageLibraryItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,sourceType,sourceId,templateKey,patientId]` on the table `MessageTask` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,key,language]` on the table `MessageTemplate` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "MessageLibraryItem_normalizedHash_language_key";

-- DropIndex
DROP INDEX "MessageTask_sourceType_sourceId_templateKey_patientId_key";

-- DropIndex
DROP INDEX "MessageTemplate_key_language_key";

-- DropIndex
DROP INDEX "MessageTemplate_tenantId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "MessageLibraryItem_tenantId_normalizedHash_language_key" ON "MessageLibraryItem"("tenantId", "normalizedHash", "language");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTask_tenantId_sourceType_sourceId_templateKey_patien_key" ON "MessageTask"("tenantId", "sourceType", "sourceId", "templateKey", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_tenantId_key_language_key" ON "MessageTemplate"("tenantId", "key", "language");
