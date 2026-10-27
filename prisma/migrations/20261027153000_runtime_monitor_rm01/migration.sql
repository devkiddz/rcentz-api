-- RM-01 additive-only storage. Apply via prisma migrate deploy after backup and review.
CREATE TABLE IF NOT EXISTS "RuntimeMonitorEvent" (
  "sourceId" VARCHAR(80) NOT NULL,
  "batchId" VARCHAR(80) NOT NULL,
  "projectId" VARCHAR(128) NOT NULL,
  "routeLabel" VARCHAR(120) NOT NULL,
  "recordedAt" TIMESTAMPTZ NOT NULL,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "requests" INTEGER NOT NULL,
  "errors" INTEGER NOT NULL,
  "functions" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  CONSTRAINT "RuntimeMonitorEvent_pkey" PRIMARY KEY ("sourceId", "batchId"),
  CONSTRAINT "RuntimeMonitorEvent_counts_check" CHECK ("requests" >= 0 AND "errors" >= 0 AND "errors" <= "requests" AND "functions" >= 0 AND "durationMs" >= 0)
);
CREATE INDEX IF NOT EXISTS "RuntimeMonitorEvent_project_time_idx" ON "RuntimeMonitorEvent" ("projectId", "recordedAt" DESC);
