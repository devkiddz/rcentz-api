-- AlterTable
ALTER TABLE "OpportunityProfile" ADD COLUMN     "careerContext" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "homeCountry" TEXT NOT NULL DEFAULT 'Nigeria',
ADD COLUMN     "maxWeeklyHours" INTEGER,
ADD COLUMN     "relocation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "researchEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "targetRoles" TEXT[] DEFAULT ARRAY['Frontend Engineer', 'Software Developer', 'Product Engineer']::TEXT[];

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "canonicalKey" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'EMPLOYMENT',
ADD COLUMN     "quarantined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "research" JSONB;

-- CreateTable
CREATE TABLE "OpportunityEvent" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunitySourceRun" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "added" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "OpportunitySourceRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityEvent_opportunityId_createdAt_idx" ON "OpportunityEvent"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "OpportunitySourceRun_profileId_startedAt_idx" ON "OpportunitySourceRun"("profileId", "startedAt");

-- CreateIndex
CREATE INDEX "Opportunity_profileId_quarantined_createdAt_idx" ON "Opportunity"("profileId", "quarantined", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_profileId_canonicalKey_key" ON "Opportunity"("profileId", "canonicalKey");

-- AddForeignKey
ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySourceRun" ADD CONSTRAINT "OpportunitySourceRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "OpportunityProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

