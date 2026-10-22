-- REVIEW CANDIDATE ONLY — NOT THE ORIGINAL 2026-09-25 FILE.
-- Reconstructed from Neon read-only catalog exports (2026-10-10).
-- DO NOT APPLY TO PRODUCTION OR INSERT INTO prisma/migrations WITHOUT REVIEW.
-- Its SHA256 WILL NOT MATCH the applied Prisma migration record.

CREATE TYPE "RcentzProductPlatform" AS ENUM ('WEB', 'PWA', 'ANDROID', 'IOS', 'WINDOWS', 'MACOS', 'LINUX', 'API');
CREATE TYPE "RcentzProductPlatformStatus" AS ENUM ('AVAILABLE', 'BETA', 'DEVELOPMENT', 'PLANNED', 'UNAVAILABLE');
CREATE TYPE "RcentzProductSecurityStatus" AS ENUM ('IMPLEMENTED', 'PARTIAL', 'PLANNED', 'UNDER_REVIEW');
CREATE TYPE "RcentzProductTechnologyCategory" AS ENUM ('LANGUAGE', 'FRAMEWORK', 'RUNTIME', 'DATABASE', 'ORM', 'AUTHENTICATION', 'INFRASTRUCTURE', 'PAYMENTS', 'ANALYTICS', 'AI', 'DEVOPS', 'OTHER');

-- FOUR DATABASE TABLES

CREATE TABLE "RcentzProductTechnology" (
    "id" text NOT NULL,
    "productId" text NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "category" "RcentzProductTechnologyCategory" NOT NULL,
    "version" text,
    "summary" text,
    "featured" boolean NOT NULL DEFAULT false,
    "sortOrder" integer NOT NULL DEFAULT 0,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "RcentzProductTechnology_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RcentzProductSecurityCapability" (
    "id" text NOT NULL,
    "productId" text NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "summary" text,
    "status" "RcentzProductSecurityStatus" NOT NULL DEFAULT 'PLANNED'::"RcentzProductSecurityStatus",
    "featured" boolean NOT NULL DEFAULT false,
    "sortOrder" integer NOT NULL DEFAULT 0,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "RcentzProductSecurityCapability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RcentzProductScaleProfile" (
    "id" text NOT NULL,
    "productId" text NOT NULL,
    "supportsMultipleUsers" boolean,
    "supportsMultiTenancy" boolean,
    "verifiedConcurrentUsers" integer,
    "verifiedRequestsPerSecond" integer,
    "publicSummary" text,
    "internalBenchmarkNotes" text,
    "benchmarkedAt" timestamp(3) without time zone,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "RcentzProductScaleProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RcentzProductPlatformAvailability" (
    "id" text NOT NULL,
    "productId" text NOT NULL,
    "platform" "RcentzProductPlatform" NOT NULL,
    "status" "RcentzProductPlatformStatus" NOT NULL,
    "url" text,
    "summary" text,
    "sortOrder" integer NOT NULL DEFAULT 0,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "RcentzProductPlatformAvailability_pkey" PRIMARY KEY ("id")
);

-- INDEXES (excluding PK-backed indexes, handled by PRIMARY KEY)
CREATE INDEX "RcentzProductPlatformAvailability_platform_idx" ON public."RcentzProductPlatformAvailability" USING btree (platform);
CREATE INDEX "RcentzProductPlatformAvailability_productId_idx" ON public."RcentzProductPlatformAvailability" USING btree ("productId");
CREATE UNIQUE INDEX "RcentzProductPlatformAvailability_productId_platform_key" ON public."RcentzProductPlatformAvailability" USING btree ("productId", platform);
CREATE INDEX "RcentzProductPlatformAvailability_publishedAt_idx" ON public."RcentzProductPlatformAvailability" USING btree ("publishedAt");
CREATE INDEX "RcentzProductPlatformAvailability_sortOrder_idx" ON public."RcentzProductPlatformAvailability" USING btree ("sortOrder");
CREATE INDEX "RcentzProductPlatformAvailability_status_idx" ON public."RcentzProductPlatformAvailability" USING btree (status);
CREATE INDEX "RcentzProductScaleProfile_benchmarkedAt_idx" ON public."RcentzProductScaleProfile" USING btree ("benchmarkedAt");
CREATE UNIQUE INDEX "RcentzProductScaleProfile_productId_key" ON public."RcentzProductScaleProfile" USING btree ("productId");
CREATE INDEX "RcentzProductScaleProfile_publishedAt_idx" ON public."RcentzProductScaleProfile" USING btree ("publishedAt");
CREATE INDEX "RcentzProductSecurityCapability_featured_idx" ON public."RcentzProductSecurityCapability" USING btree (featured);
CREATE INDEX "RcentzProductSecurityCapability_productId_idx" ON public."RcentzProductSecurityCapability" USING btree ("productId");
CREATE UNIQUE INDEX "RcentzProductSecurityCapability_productId_slug_key" ON public."RcentzProductSecurityCapability" USING btree ("productId", slug);
CREATE INDEX "RcentzProductSecurityCapability_publishedAt_idx" ON public."RcentzProductSecurityCapability" USING btree ("publishedAt");
CREATE INDEX "RcentzProductSecurityCapability_sortOrder_idx" ON public."RcentzProductSecurityCapability" USING btree ("sortOrder");
CREATE INDEX "RcentzProductSecurityCapability_status_idx" ON public."RcentzProductSecurityCapability" USING btree (status);
CREATE INDEX "RcentzProductTechnology_category_idx" ON public."RcentzProductTechnology" USING btree (category);
CREATE INDEX "RcentzProductTechnology_featured_idx" ON public."RcentzProductTechnology" USING btree (featured);
CREATE INDEX "RcentzProductTechnology_productId_idx" ON public."RcentzProductTechnology" USING btree ("productId");
CREATE UNIQUE INDEX "RcentzProductTechnology_productId_slug_key" ON public."RcentzProductTechnology" USING btree ("productId", slug);
CREATE INDEX "RcentzProductTechnology_publishedAt_idx" ON public."RcentzProductTechnology" USING btree ("publishedAt");
CREATE INDEX "RcentzProductTechnology_sortOrder_idx" ON public."RcentzProductTechnology" USING btree ("sortOrder");

-- PRODUCT FOREIGN KEYS
ALTER TABLE "RcentzProductTechnology" ADD CONSTRAINT "RcentzProductTechnology_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RcentzProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RcentzProductSecurityCapability" ADD CONSTRAINT "RcentzProductSecurityCapability_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RcentzProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RcentzProductScaleProfile" ADD CONSTRAINT "RcentzProductScaleProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RcentzProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RcentzProductPlatformAvailability" ADD CONSTRAINT "RcentzProductPlatformAvailability_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RcentzProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
