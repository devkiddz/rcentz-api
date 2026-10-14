-- Client Acquisition P2: create-only, isolated commercial data.
-- Rehearsal migration only until reviewed and explicitly deployed.
CREATE TABLE "ClientAcquisitionSettings" (
 "id" TEXT NOT NULL, "companyProfileId" TEXT NOT NULL, "ownerId" TEXT NOT NULL,
 "regions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "industries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "engagementTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "preferredSources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "businessProblems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "includeUnpriced" BOOLEAN NOT NULL DEFAULT true,
 "requireBudget" BOOLEAN NOT NULL DEFAULT false,
 "discoveryEnabled" BOOLEAN NOT NULL DEFAULT false,
 "minimumScore" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ClientAcquisitionSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClientProspect" (
 "id" TEXT NOT NULL, "companyProfileId" TEXT NOT NULL, "ownerId" TEXT NOT NULL,
 "source" TEXT NOT NULL, "externalId" TEXT NOT NULL, "canonicalKey" TEXT,
 "businessName" TEXT NOT NULL, "summary" TEXT NOT NULL,
 "website" TEXT, "country" TEXT, "industry" TEXT,
 "problemSignals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "engagementTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "budgetSignal" TEXT,
 "evidenceLinks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "fitScore" INTEGER, "qualification" JSONB NOT NULL DEFAULT '{}',
 "state" TEXT NOT NULL DEFAULT 'NEW', "notes" TEXT NOT NULL DEFAULT '',
 "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ClientProspect_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ClientProspect_fitScore_check" CHECK ("fitScore" IS NULL OR ("fitScore" BETWEEN 0 AND 100))
);
CREATE TABLE "ClientProspectCapabilityMatch" (
 "id" TEXT NOT NULL, "prospectId" TEXT NOT NULL, "capabilityId" TEXT NOT NULL,
 "rationale" TEXT NOT NULL, "score" INTEGER,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ClientProspectCapabilityMatch_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ClientProspectCapabilityMatch_score_check" CHECK ("score" IS NULL OR ("score" BETWEEN 0 AND 100))
);
CREATE UNIQUE INDEX "ClientAcquisitionSettings_companyProfileId_key" ON "ClientAcquisitionSettings"("companyProfileId");
CREATE INDEX "ClientAcquisitionSettings_ownerId_idx" ON "ClientAcquisitionSettings"("ownerId");
CREATE UNIQUE INDEX "ClientProspect_companyProfileId_source_externalId_key" ON "ClientProspect"("companyProfileId", "source", "externalId");
CREATE UNIQUE INDEX "ClientProspect_companyProfileId_canonicalKey_key" ON "ClientProspect"("companyProfileId", "canonicalKey");
CREATE INDEX "ClientProspect_companyProfileId_state_createdAt_idx" ON "ClientProspect"("companyProfileId", "state", "createdAt");
CREATE INDEX "ClientProspect_ownerId_state_idx" ON "ClientProspect"("ownerId", "state");
CREATE UNIQUE INDEX "ClientProspectCapabilityMatch_prospectId_capabilityId_key" ON "ClientProspectCapabilityMatch"("prospectId", "capabilityId");
CREATE INDEX "ClientProspectCapabilityMatch_capabilityId_idx" ON "ClientProspectCapabilityMatch"("capabilityId");
ALTER TABLE "ClientAcquisitionSettings" ADD CONSTRAINT "ClientAcquisitionSettings_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyOpportunityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientAcquisitionSettings" ADD CONSTRAINT "ClientAcquisitionSettings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientProspect" ADD CONSTRAINT "ClientProspect_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyOpportunityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientProspect" ADD CONSTRAINT "ClientProspect_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientProspectCapabilityMatch" ADD CONSTRAINT "ClientProspectCapabilityMatch_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "ClientProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientProspectCapabilityMatch" ADD CONSTRAINT "ClientProspectCapabilityMatch_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "CompanyCapability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
