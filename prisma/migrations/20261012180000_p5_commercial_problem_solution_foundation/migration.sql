-- P5 Commercial Knowledge: additive problem catalogue with reusable solutions.
-- Staging only: DO NOT APPLY to production.
CREATE TABLE "CommercialBusinessProblem" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "symptoms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "impact" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "CompanyCapabilityStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercialBusinessProblem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CommercialSolutionGroup" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercialSolutionGroup_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CommercialProblemSolution" (
  "id" TEXT NOT NULL,
  "problemId" TEXT NOT NULL,
  "solutionId" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "qualificationCriteria" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialProblemSolution_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "CapabilitySolution" ADD COLUMN "groupId" TEXT;
CREATE UNIQUE INDEX "CommercialBusinessProblem_profileId_key_key" ON "CommercialBusinessProblem"("profileId", "key");
CREATE INDEX "CommercialBusinessProblem_profileId_status_idx" ON "CommercialBusinessProblem"("profileId", "status");
CREATE UNIQUE INDEX "CommercialSolutionGroup_profileId_key_key" ON "CommercialSolutionGroup"("profileId", "key");
CREATE UNIQUE INDEX "CommercialProblemSolution_problemId_solutionId_key" ON "CommercialProblemSolution"("problemId", "solutionId");
CREATE INDEX "CommercialProblemSolution_solutionId_idx" ON "CommercialProblemSolution"("solutionId");
CREATE INDEX "CapabilitySolution_groupId_idx" ON "CapabilitySolution"("groupId");
ALTER TABLE "CommercialBusinessProblem" ADD CONSTRAINT "CommercialBusinessProblem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CompanyOpportunityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialSolutionGroup" ADD CONSTRAINT "CommercialSolutionGroup_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CompanyOpportunityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialProblemSolution" ADD CONSTRAINT "CommercialProblemSolution_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "CommercialBusinessProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialProblemSolution" ADD CONSTRAINT "CommercialProblemSolution_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "CapabilitySolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilitySolution" ADD CONSTRAINT "CapabilitySolution_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommercialSolutionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
