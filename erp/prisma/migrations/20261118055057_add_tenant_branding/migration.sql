-- CreateTable
CREATE TABLE "TenantBrand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clinicName" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "phones" JSONB NOT NULL DEFAULT '[]',
    "email" TEXT NOT NULL DEFAULT '',
    "socials" JSONB NOT NULL DEFAULT '{}',
    "smsSenderName" TEXT NOT NULL DEFAULT 'Clinic',
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
    "locales" JSONB NOT NULL DEFAULT '["en","am"]',
    "colors" JSONB NOT NULL DEFAULT '{"primary":"#0F766E","secondary":"#0EA5E9","accent":"#FFFFFF"}',
    "logoKey" TEXT,
    "logoDarkKey" TEXT,
    "heroKey" TEXT,
    "heroSecondaryKey" TEXT,
    "doctorName" TEXT NOT NULL DEFAULT '',
    "doctorTitle" TEXT NOT NULL DEFAULT '',
    "doctorBio" TEXT NOT NULL DEFAULT '',
    "doctorPhotoKey" TEXT,
    "trialBanner" BOOLEAN NOT NULL DEFAULT false,
    "trialBannerText" TEXT NOT NULL DEFAULT 'Trial / Demo data',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TenantBrand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantBrand_tenantId_key" ON "TenantBrand"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantBrand" ADD CONSTRAINT "TenantBrand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
