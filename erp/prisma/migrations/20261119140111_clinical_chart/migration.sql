-- CreateEnum
CREATE TYPE "ClinicalPlanStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ClinicalSuggestion" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ClinicalSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalProfile" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "historyNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ClinicalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalTextItem" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ClinicalTextItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalTooth" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "toothNumber" INTEGER NOT NULL,
    "finding" TEXT,
    "findingColor" TEXT,
    "findingIsCustom" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ClinicalTooth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalSurface" (
    "id" TEXT NOT NULL,
    "toothId" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "note" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ClinicalSurface_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalVisit" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitDate" DATE NOT NULL,
    "body" TEXT,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "diagnosis" TEXT,
    "materials" TEXT,
    "anesthesia" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ClinicalVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalPlanItem" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serviceId" TEXT,
    "procedureName" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "toothNumber" INTEGER,
    "status" "ClinicalPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "saleId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ClinicalPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalSearch" (
    "patientId" TEXT NOT NULL,
    "searchText" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ClinicalSearch_pkey" PRIMARY KEY ("patientId")
);

-- CreateIndex
CREATE INDEX "ClinicalSuggestion_tenantId_category_active_idx" ON "ClinicalSuggestion"("tenantId", "category", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalSuggestion_tenantId_category_normalizedKey_key" ON "ClinicalSuggestion"("tenantId", "category", "normalizedKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalProfile_patientId_key" ON "ClinicalProfile"("patientId");

-- CreateIndex
CREATE INDEX "ClinicalProfile_tenantId_idx" ON "ClinicalProfile"("tenantId");

-- CreateIndex
CREATE INDEX "ClinicalTextItem_patientId_kind_idx" ON "ClinicalTextItem"("patientId", "kind");

-- CreateIndex
CREATE INDEX "ClinicalTextItem_tenantId_idx" ON "ClinicalTextItem"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalTextItem_tenantId_patientId_kind_text_key" ON "ClinicalTextItem"("tenantId", "patientId", "kind", "text");

-- CreateIndex
CREATE INDEX "ClinicalTooth_patientId_idx" ON "ClinicalTooth"("patientId");

-- CreateIndex
CREATE INDEX "ClinicalTooth_tenantId_idx" ON "ClinicalTooth"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalTooth_tenantId_patientId_toothNumber_key" ON "ClinicalTooth"("tenantId", "patientId", "toothNumber");

-- CreateIndex
CREATE INDEX "ClinicalSurface_toothId_idx" ON "ClinicalSurface"("toothId");

-- CreateIndex
CREATE INDEX "ClinicalSurface_tenantId_idx" ON "ClinicalSurface"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalSurface_tenantId_toothId_surface_key" ON "ClinicalSurface"("tenantId", "toothId", "surface");

-- CreateIndex
CREATE INDEX "ClinicalVisit_patientId_visitDate_idx" ON "ClinicalVisit"("patientId", "visitDate");

-- CreateIndex
CREATE INDEX "ClinicalVisit_tenantId_idx" ON "ClinicalVisit"("tenantId");

-- CreateIndex
CREATE INDEX "ClinicalPlanItem_patientId_status_idx" ON "ClinicalPlanItem"("patientId", "status");

-- CreateIndex
CREATE INDEX "ClinicalPlanItem_tenantId_idx" ON "ClinicalPlanItem"("tenantId");

-- CreateIndex
CREATE INDEX "ClinicalSearch_tenantId_idx" ON "ClinicalSearch"("tenantId");

-- AddForeignKey
ALTER TABLE "ClinicalSuggestion" ADD CONSTRAINT "ClinicalSuggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalProfile" ADD CONSTRAINT "ClinicalProfile_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalProfile" ADD CONSTRAINT "ClinicalProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalTextItem" ADD CONSTRAINT "ClinicalTextItem_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalTextItem" ADD CONSTRAINT "ClinicalTextItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalTooth" ADD CONSTRAINT "ClinicalTooth_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalTooth" ADD CONSTRAINT "ClinicalTooth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalSurface" ADD CONSTRAINT "ClinicalSurface_toothId_fkey" FOREIGN KEY ("toothId") REFERENCES "ClinicalTooth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalSurface" ADD CONSTRAINT "ClinicalSurface_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalVisit" ADD CONSTRAINT "ClinicalVisit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalVisit" ADD CONSTRAINT "ClinicalVisit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPlanItem" ADD CONSTRAINT "ClinicalPlanItem_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPlanItem" ADD CONSTRAINT "ClinicalPlanItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPlanItem" ADD CONSTRAINT "ClinicalPlanItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPlanItem" ADD CONSTRAINT "ClinicalPlanItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalSearch" ADD CONSTRAINT "ClinicalSearch_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalSearch" ADD CONSTRAINT "ClinicalSearch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Full-text index for the doctor chart search. 'simple' preserves Amharic
-- terms instead of applying an English stemmer.
CREATE INDEX "ClinicalSearch_searchText_fts_idx"
  ON "ClinicalSearch" USING GIN (to_tsvector('simple', "searchText"));
