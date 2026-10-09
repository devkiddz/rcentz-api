-- CreateTable
CREATE TABLE "ApplicationIdentity" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopes" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationRequestNonce" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationRequestNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityProfile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "skills" TEXT[],
    "experienceYears" INTEGER NOT NULL DEFAULT 2,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "salary" TEXT,
    "jobType" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceState" TEXT NOT NULL DEFAULT 'LISTED',
    "score" INTEGER NOT NULL,
    "assessment" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityRun" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "added" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "OpportunityRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationIdentity_userId_applicationId_idx" ON "ApplicationIdentity"("userId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationIdentity_applicationId_subject_key" ON "ApplicationIdentity"("applicationId", "subject");

-- CreateIndex
CREATE INDEX "ApplicationRequestNonce_expiresAt_idx" ON "ApplicationRequestNonce"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationRequestNonce_applicationId_nonce_key" ON "ApplicationRequestNonce"("applicationId", "nonce");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityProfile_ownerId_key" ON "OpportunityProfile"("ownerId");

-- CreateIndex
CREATE INDEX "Opportunity_profileId_status_score_idx" ON "Opportunity"("profileId", "status", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_profileId_source_externalId_key" ON "Opportunity"("profileId", "source", "externalId");

-- CreateIndex
CREATE INDEX "OpportunityRun_profileId_startedAt_idx" ON "OpportunityRun"("profileId", "startedAt");

-- AddForeignKey
ALTER TABLE "ApplicationIdentity" ADD CONSTRAINT "ApplicationIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityProfile" ADD CONSTRAINT "OpportunityProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "OpportunityProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityRun" ADD CONSTRAINT "OpportunityRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "OpportunityProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
