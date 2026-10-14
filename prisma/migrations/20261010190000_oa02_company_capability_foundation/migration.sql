-- OA-02 company capability foundation; additive. Review before running.
CREATE TYPE "CompanyCapabilityStatus" AS ENUM ('DRAFT','READY','PAUSED','ARCHIVED');
CREATE TYPE "CapabilityEvidenceState" AS ENUM ('PROPOSED','INSPECTED','LOCALLY_TESTED','LIVE_TESTED','CLIENT_DELIVERED');
CREATE TABLE "CompanyOpportunityProfile" (
 "id" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "operatingCountry" TEXT NOT NULL,
 "deliveryMode" TEXT NOT NULL, "availabilityNote" TEXT NOT NULL DEFAULT 'Needs confirmation',
 "earliestStartAt" TIMESTAMP(3), "weeklyHours" INTEGER, "concurrentCapacity" INTEGER,
 "managerId" TEXT NOT NULL, "reviewedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CompanyOpportunityProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CompanyCapability" (
 "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "serviceId" TEXT NOT NULL, "key" TEXT NOT NULL,
 "name" TEXT NOT NULL, "purpose" TEXT NOT NULL, "status" "CompanyCapabilityStatus" NOT NULL DEFAULT 'DRAFT',
 "businessProblems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "buyerPhrases" JSONB NOT NULL DEFAULT '{}',
 "possibleWork" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "agreementTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "deliveryLimits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "reviewedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CompanyCapability_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CapabilitySolution" (
 "id" TEXT NOT NULL, "capabilityId" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL,
 "problem" TEXT NOT NULL, "intendedUsers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "proposedWorkflow" TEXT NOT NULL,
 "deliverables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "buyerPhrases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "discoveryQuestions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "exclusions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "status" "CompanyCapabilityStatus" NOT NULL DEFAULT 'DRAFT',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CapabilitySolution_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CapabilityEvidence" (
 "id" TEXT NOT NULL, "capabilityId" TEXT NOT NULL, "solutionId" TEXT, "projectId" TEXT,
 "productId" TEXT, "contribution" TEXT NOT NULL, "supportedClaim" TEXT NOT NULL,
 "state" "CapabilityEvidenceState" NOT NULL DEFAULT 'PROPOSED', "verifiedAt" TIMESTAMP(3), "reviewedById" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CapabilityEvidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyOpportunityProfile_key_key" ON "CompanyOpportunityProfile"("key");
CREATE UNIQUE INDEX "CompanyCapability_profileId_key_key" ON "CompanyCapability"("profileId","key");
CREATE INDEX "CompanyCapability_serviceId_idx" ON "CompanyCapability"("serviceId");
CREATE INDEX "CompanyCapability_status_idx" ON "CompanyCapability"("status");
CREATE UNIQUE INDEX "CapabilitySolution_capabilityId_key_key" ON "CapabilitySolution"("capabilityId","key");
CREATE INDEX "CapabilityEvidence_projectId_idx" ON "CapabilityEvidence"("projectId");
CREATE INDEX "CapabilityEvidence_productId_idx" ON "CapabilityEvidence"("productId");
CREATE INDEX "CapabilityEvidence_capabilityId_state_idx" ON "CapabilityEvidence"("capabilityId","state");
ALTER TABLE "CompanyOpportunityProfile" ADD CONSTRAINT "CompanyOpportunityProfile_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyCapability" ADD CONSTRAINT "CompanyCapability_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CompanyOpportunityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyCapability" ADD CONSTRAINT "CompanyCapability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilitySolution" ADD CONSTRAINT "CapabilitySolution_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "CompanyCapability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityEvidence" ADD CONSTRAINT "CapabilityEvidence_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "CompanyCapability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityEvidence" ADD CONSTRAINT "CapabilityEvidence_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "CapabilitySolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityEvidence" ADD CONSTRAINT "CapabilityEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityEvidence" ADD CONSTRAINT "CapabilityEvidence_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RcentzProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityEvidence" ADD CONSTRAINT "CapabilityEvidence_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
