-- Additive. Keeps RuntimeMonitorEvent and all existing analytics untouched.
CREATE TABLE "IntelligenceEvent" (
  "sourceId" VARCHAR(80) NOT NULL,
  "eventId" VARCHAR(36) NOT NULL,
  "projectId" VARCHAR(128) NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL,
  "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kind" VARCHAR(16) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "environment" VARCHAR(16) NOT NULL,
  "featureKey" VARCHAR(100),
  "measurements" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dimensions" JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "IntelligenceEvent_pkey" PRIMARY KEY ("sourceId","eventId")
);
CREATE INDEX "IntelligenceEvent_project_time_idx" ON "IntelligenceEvent"("projectId","occurredAt" DESC);
CREATE INDEX "IntelligenceEvent_project_feature_idx" ON "IntelligenceEvent"("projectId","featureKey","occurredAt" DESC);
