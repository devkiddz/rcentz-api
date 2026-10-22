-- Additive database-backed source configuration. Existing sources remain disabled until explicitly reviewed.
ALTER TABLE "DeliverySource"
 ADD COLUMN "actorId" TEXT,
 ADD COLUMN "baselineSha" TEXT,
 ADD COLUMN "requiredChecks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 ADD COLUMN "vercelProjectId" TEXT,
 ADD COLUMN "vercelTeamId" TEXT,
 ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT false;