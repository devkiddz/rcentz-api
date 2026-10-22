-- Additive only: preserves historical migration bytes and existing milestone rows.
CREATE TABLE "DeliverySource" (
 "id" TEXT PRIMARY KEY, "projectId" TEXT NOT NULL, "repository" TEXT NOT NULL, "branch" TEXT NOT NULL,
 "configHash" TEXT NOT NULL, "cursorSha" TEXT NOT NULL, "activeKey" TEXT, "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3),
 "lastSyncedAt" TIMESTAMP(3), "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DeliverySource_repository_branch_key" ON "DeliverySource"("repository","branch");
CREATE INDEX "DeliverySource_projectId_idx" ON "DeliverySource"("projectId");
CREATE TABLE "DeliveryMilestone" (
 "id" TEXT PRIMARY KEY, "sourceId" TEXT NOT NULL, "key" TEXT NOT NULL, "milestoneId" TEXT NOT NULL,
 "phase" TEXT NOT NULL DEFAULT 'OPEN', "completionSha" TEXT, "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("sourceId") REFERENCES "DeliverySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DeliveryMilestone_phase_check" CHECK ("phase" IN ('OPEN','AWAITING','COMPLETE','CANCELLED'))
);
CREATE UNIQUE INDEX "DeliveryMilestone_milestoneId_key" ON "DeliveryMilestone"("milestoneId");
CREATE UNIQUE INDEX "DeliveryMilestone_sourceId_key_key" ON "DeliveryMilestone"("sourceId","key");
CREATE INDEX "DeliveryMilestone_sourceId_phase_checkedAt_idx" ON "DeliveryMilestone"("sourceId","phase","checkedAt");
CREATE TABLE "DeliveryCommit" (
 "id" TEXT PRIMARY KEY, "sourceId" TEXT NOT NULL, "deliveryMilestoneId" TEXT, "sha" TEXT NOT NULL, "message" TEXT NOT NULL,
 "committedAt" TIMESTAMP(3) NOT NULL, "issue" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("sourceId") REFERENCES "DeliverySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("deliveryMilestoneId") REFERENCES "DeliveryMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DeliveryCommit_sourceId_sha_key" ON "DeliveryCommit"("sourceId","sha");
CREATE INDEX "DeliveryCommit_deliveryMilestoneId_createdAt_id_idx" ON "DeliveryCommit"("deliveryMilestoneId","createdAt","id");
CREATE TABLE "DeliveryObservation" (
 "id" TEXT PRIMARY KEY, "deliveryMilestoneId" TEXT NOT NULL, "commitSha" TEXT NOT NULL, "snapshot" JSONB NOT NULL,
 "fingerprint" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("deliveryMilestoneId") REFERENCES "DeliveryMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DeliveryObservation_deliveryMilestoneId_createdAt_id_idx" ON "DeliveryObservation"("deliveryMilestoneId","createdAt","id");
CREATE TABLE "ProjectGovernanceEvent" (
 "id" TEXT PRIMARY KEY, "projectId" TEXT NOT NULL, "milestoneId" TEXT, "actorId" TEXT NOT NULL,
 "operation" TEXT NOT NULL, "snapshot" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProjectGovernanceEvent_projectId_createdAt_idx" ON "ProjectGovernanceEvent"("projectId","createdAt");
CREATE INDEX "ProjectGovernanceEvent_milestoneId_createdAt_idx" ON "ProjectGovernanceEvent"("milestoneId","createdAt");
-- Append-only audit at the database boundary. Existing audits are preserved.
CREATE FUNCTION "rcentz_reject_audit_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records are append-only'; END; $$;
CREATE TRIGGER "ProjectGovernanceEvent_append_only" BEFORE UPDATE OR DELETE ON "ProjectGovernanceEvent" FOR EACH ROW EXECUTE FUNCTION "rcentz_reject_audit_mutation"();
CREATE TRIGGER "DeliveryObservation_append_only" BEFORE UPDATE OR DELETE ON "DeliveryObservation" FOR EACH ROW EXECUTE FUNCTION "rcentz_reject_audit_mutation"();
CREATE TRIGGER "ProjectMilestoneReview_append_only" BEFORE UPDATE OR DELETE ON "ProjectMilestoneReview" FOR EACH ROW EXECUTE FUNCTION "rcentz_reject_audit_mutation"();
CREATE TRIGGER "ProjectProgressOverride_append_only" BEFORE UPDATE OR DELETE ON "ProjectProgressOverride" FOR EACH ROW EXECUTE FUNCTION "rcentz_reject_audit_mutation"();
