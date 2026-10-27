-- RM-02: database-backed per-project observability source registry.
-- Append-only migration. Existing RuntimeMonitorEvent rows remain untouched.
CREATE TABLE "RuntimeMonitorSource" (
  "id" VARCHAR(80) NOT NULL PRIMARY KEY,
  "projectId" VARCHAR(128) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "revokedAt" TIMESTAMPTZ,
  CONSTRAINT "RuntimeMonitorSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);
CREATE INDEX "RuntimeMonitorSource_projectId_idx" ON "RuntimeMonitorSource"("projectId");
