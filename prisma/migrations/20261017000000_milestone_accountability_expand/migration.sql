-- R1B EXPAND ONLY. No backfill, no updates, no deletions, no auto-approval.
CREATE TABLE "ProjectMilestoneCriterion" (
 "id" TEXT NOT NULL,
 "milestoneId" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "description" TEXT,
 "required" BOOLEAN NOT NULL DEFAULT true,
 "sortOrder" INTEGER NOT NULL DEFAULT 0,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "verified" BOOLEAN NOT NULL DEFAULT false,
 "evidence" JSONB,
 "verifiedById" TEXT,
 "verifiedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ProjectMilestoneCriterion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProjectMilestoneReview" (
 "id" TEXT NOT NULL,
 "milestoneId" TEXT NOT NULL,
 "reviewerId" TEXT NOT NULL,
 "decision" TEXT NOT NULL,
 "criteriaRevision" INTEGER NOT NULL,
 "reason" TEXT,
 "criteriaSnapshot" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ProjectMilestoneReview_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProjectProgressOverride" (
 "id" TEXT NOT NULL,
 "projectId" TEXT NOT NULL,
 "actorId" TEXT NOT NULL,
 "calculatedPercent" INTEGER,
 "overriddenPercent" INTEGER NOT NULL,
 "reason" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ProjectProgressOverride_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectMilestoneCriterion_milestoneId_sortOrder_idx" ON "ProjectMilestoneCriterion"("milestoneId","sortOrder");
CREATE INDEX "ProjectMilestoneCriterion_milestoneId_verified_idx" ON "ProjectMilestoneCriterion"("milestoneId","verified");
CREATE INDEX "ProjectMilestoneReview_milestoneId_createdAt_idx" ON "ProjectMilestoneReview"("milestoneId","createdAt");
CREATE INDEX "ProjectMilestoneReview_reviewerId_createdAt_idx" ON "ProjectMilestoneReview"("reviewerId","createdAt");
CREATE INDEX "ProjectProgressOverride_projectId_createdAt_idx" ON "ProjectProgressOverride"("projectId","createdAt");
CREATE INDEX "ProjectProgressOverride_actorId_createdAt_idx" ON "ProjectProgressOverride"("actorId","createdAt");
ALTER TABLE "ProjectMilestoneCriterion" ADD CONSTRAINT "ProjectMilestoneCriterion_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectMilestoneReview" ADD CONSTRAINT "ProjectMilestoneReview_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectProgressOverride" ADD CONSTRAINT "ProjectProgressOverride_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
