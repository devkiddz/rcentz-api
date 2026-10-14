CREATE TABLE "ClientDiscoverySource" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homepage" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "approval" TEXT NOT NULL DEFAULT 'DRAFT',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "permittedEndpoint" TEXT,
    "cadenceMinutes" INTEGER NOT NULL DEFAULT 1440,
    "maxItemsPerRun" INTEGER NOT NULL DEFAULT 20,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientDiscoverySource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientDiscoverySource_profileId_key_key" ON "ClientDiscoverySource"("profileId","key");
CREATE INDEX "ClientDiscoverySource_profileId_approval_enabled_idx" ON "ClientDiscoverySource"("profileId","approval","enabled");
ALTER TABLE "ClientDiscoverySource" ADD CONSTRAINT "ClientDiscoverySource_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CompanyOpportunityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
