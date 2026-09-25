-- =========================================================
-- EXPAND RCENTZ PRODUCT DOMAIN
--
-- Migrates the original lightweight RcentzProduct catalogue
-- into the long-lived Product public-contract domain.
--
-- Existing product state and media relationships are
-- translated rather than silently discarded.
-- =========================================================


-- =========================================================
-- ENUMS
-- =========================================================

CREATE TYPE "RcentzProductStage" AS ENUM (
    'CONCEPT',
    'PLANNING',
    'DEVELOPMENT',
    'TESTING',
    'BETA',
    'PRODUCTION',
    'MAINTENANCE',
    'PAUSED',
    'RETIRED'
);

CREATE TYPE "RcentzProductUpdateType" AS ENUM (
    'PLANNING',
    'DEVELOPMENT',
    'MILESTONE',
    'PREVIEW',
    'TESTING',
    'BETA',
    'RELEASE',
    'IMPROVEMENT',
    'MAINTENANCE',
    'ANNOUNCEMENT'
);

CREATE TYPE "RcentzProductPublicationType" AS ENUM (
    'STORY',
    'RELEASE_NOTE',
    'USE_CASE',
    'CONTRIBUTION',
    'LEARNING',
    'DOCUMENTATION',
    'GUIDE',
    'FAQ'
);

CREATE TYPE "RcentzProductPolicyType" AS ENUM (
    'TERMS_OF_USE',
    'PRIVACY_POLICY',
    'ACCEPTABLE_USE',
    'DATA_POLICY',
    'COOKIE_POLICY',
    'LICENSE',
    'COMMUNITY_GUIDELINES',
    'OTHER'
);

CREATE TYPE "RcentzProductGalleryType" AS ENUM (
    'GENERAL',
    'PRODUCT',
    'DEVELOPMENT',
    'RELEASE',
    'BRAND',
    'DOCUMENTATION'
);


-- =========================================================
-- EXPAND EXISTING RCENTZ PRODUCT
--
-- Keep the original fields temporarily so their values can
-- be translated into the new domain.
-- =========================================================

ALTER TABLE "RcentzProduct"
ADD COLUMN "aboutNotes" TEXT,
ADD COLUMN "contribution" TEXT,
ADD COLUMN "currentVersion" TEXT,
ADD COLUMN "expectedReleaseAt" TIMESTAMP(3),
ADD COLUMN "firstReleasedAt" TIMESTAMP(3),
ADD COLUMN "intendedUse" TEXT,
ADD COLUMN "isReleased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "latestReleasedAt" TIMESTAMP(3),
ADD COLUMN "productionStartedAt" TIMESTAMP(3),
ADD COLUMN "purpose" TEXT,
ADD COLUMN "retiredAt" TIMESTAMP(3),
ADD COLUMN "stage" "RcentzProductStage" NOT NULL DEFAULT 'CONCEPT',
ADD COLUMN "tagline" TEXT,
ALTER COLUMN "progress" DROP NOT NULL,
ALTER COLUMN "progress" DROP DEFAULT;


-- =========================================================
-- MEDIA PREPARATION
--
-- The old model connected MediaAsset directly to Product.
-- The new model connects media through Product Galleries.
--
-- Keep the old relationship temporarily while migrating.
-- =========================================================

ALTER TABLE "MediaAsset"
ADD COLUMN "rcentzProductGalleryId" TEXT;


-- =========================================================
-- PRODUCT PRODUCTION HISTORY
-- =========================================================

CREATE TABLE "RcentzProductUpdate" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    "summary" TEXT,
    "content" TEXT,

    "type" "RcentzProductUpdateType" NOT NULL,

    "version" TEXT,

    "stageSnapshot" "RcentzProductStage",
    "progressSnapshot" INTEGER,

    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RcentzProductUpdate_pkey"
        PRIMARY KEY ("id")
);


-- =========================================================
-- PRODUCT PUBLICATIONS
--
-- Stories, release notes, learning material,
-- documentation and other long-form Product knowledge.
-- =========================================================

CREATE TABLE "RcentzProductPublication" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    "excerpt" TEXT,
    "content" TEXT NOT NULL,

    "type" "RcentzProductPublicationType" NOT NULL,

    "version" TEXT,

    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    "publishedAt" TIMESTAMP(3),

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RcentzProductPublication_pkey"
        PRIMARY KEY ("id")
);


-- =========================================================
-- PRODUCT GALLERIES
-- =========================================================

CREATE TABLE "RcentzProductGallery" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    "description" TEXT,

    "type" "RcentzProductGalleryType"
        NOT NULL DEFAULT 'GENERAL',

    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    "publishedAt" TIMESTAMP(3),

    "createdAt" TIMESTAMP(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RcentzProductGallery_pkey"
        PRIMARY KEY ("id")
);


-- =========================================================
-- PRODUCT POLICIES
--
-- Policies are versioned records so product contracts can
-- evolve without rewriting their historical meaning.
-- =========================================================

CREATE TABLE "RcentzProductPolicy" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    "type" "RcentzProductPolicyType" NOT NULL,

    "version" TEXT NOT NULL,

    "summary" TEXT,
    "content" TEXT NOT NULL,

    "requiresAcceptance" BOOLEAN NOT NULL DEFAULT false,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,

    "effectiveAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),

    "createdAt" TIMESTAMP(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RcentzProductPolicy_pkey"
        PRIMARY KEY ("id")
);


-- =========================================================
-- PRESERVE EXISTING PRODUCT STATE
-- =========================================================

UPDATE "RcentzProduct"
SET
    "stage" =
        CASE "status"::text
            WHEN 'DRAFT'
                THEN 'CONCEPT'::"RcentzProductStage"

            WHEN 'DEVELOPMENT'
                THEN 'DEVELOPMENT'::"RcentzProductStage"

            WHEN 'COMING_SOON'
                THEN 'PLANNING'::"RcentzProductStage"

            WHEN 'BETA'
                THEN 'BETA'::"RcentzProductStage"

            WHEN 'PUBLISHED'
                THEN 'PRODUCTION'::"RcentzProductStage"

            WHEN 'PAUSED'
                THEN 'PAUSED'::"RcentzProductStage"

            WHEN 'RETIRED'
                THEN 'RETIRED'::"RcentzProductStage"

            ELSE
                'CONCEPT'::"RcentzProductStage"
        END,

    "expectedReleaseAt" =
        "expectedLaunchAt",

    "firstReleasedAt" =
        "launchedAt",

    "latestReleasedAt" =
        "launchedAt",

    "isReleased" =
        CASE
            WHEN "status"::text = 'PUBLISHED'
                THEN true

            WHEN "launchedAt" IS NOT NULL
                THEN true

            ELSE false
        END,

    "retiredAt" =
        CASE
            WHEN "status"::text = 'RETIRED'
                THEN COALESCE(
                    "launchedAt",
                    "updatedAt"
                )

            ELSE NULL
        END,

    -- Old visibility represented whether the catalogue
    -- record was eligible for public presentation.
    --
    -- In the new contract, publication is represented by
    -- publishedAt rather than a separate visibility flag.
    "publishedAt" =
        CASE
            WHEN "visible" = false
                THEN NULL

            ELSE "publishedAt"
        END;


-- =========================================================
-- PRESERVE EXISTING PRODUCT MEDIA
--
-- If the previous Product model already had directly linked
-- media, create one Product Gallery for that product and
-- move those MediaAsset relationships into it.
--
-- The slug matches our seed manifest:
--     product-gallery
--
-- meaning future seeds will update this same gallery rather
-- than creating a duplicate.
-- =========================================================

INSERT INTO "RcentzProductGallery" (
    "id",
    "productId",
    "name",
    "slug",
    "description",
    "type",
    "featured",
    "sortOrder",
    "publishedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy-product-gallery-' || product."id",
    product."id",
    'Product Gallery',
    'product-gallery',
    'Product media carried forward from the original Rcentz Product catalogue.',
    'PRODUCT'::"RcentzProductGalleryType",
    true,
    0,
    product."publishedAt",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "RcentzProduct" AS product
WHERE EXISTS (
    SELECT 1
    FROM "MediaAsset" AS media
    WHERE media."rcentzProductId" = product."id"
);


UPDATE "MediaAsset" AS media
SET "rcentzProductGalleryId" =
    'legacy-product-gallery-' || media."rcentzProductId"
WHERE media."rcentzProductId" IS NOT NULL;


-- =========================================================
-- REMOVE OLD RELATIONSHIP / PRODUCT STATE
--
-- All meaningful state has now been translated.
-- =========================================================

ALTER TABLE "MediaAsset"
DROP CONSTRAINT "MediaAsset_rcentzProductId_fkey";

DROP INDEX "MediaAsset_rcentzProductId_idx";

DROP INDEX "RcentzProduct_status_idx";

DROP INDEX "RcentzProduct_visible_idx";


ALTER TABLE "MediaAsset"
DROP COLUMN "rcentzProductId";


ALTER TABLE "RcentzProduct"
DROP COLUMN "expectedLaunchAt",
DROP COLUMN "launchedAt",
DROP COLUMN "status",
DROP COLUMN "visible";


DROP TYPE "RcentzProductStatus";


-- =========================================================
-- PRODUCT UPDATE INDEXES
-- =========================================================

CREATE INDEX
    "RcentzProductUpdate_productId_idx"
ON "RcentzProductUpdate"("productId");

CREATE INDEX
    "RcentzProductUpdate_type_idx"
ON "RcentzProductUpdate"("type");

CREATE INDEX
    "RcentzProductUpdate_occurredAt_idx"
ON "RcentzProductUpdate"("occurredAt");

CREATE INDEX
    "RcentzProductUpdate_publishedAt_idx"
ON "RcentzProductUpdate"("publishedAt");

CREATE UNIQUE INDEX
    "RcentzProductUpdate_productId_slug_key"
ON "RcentzProductUpdate"(
    "productId",
    "slug"
);


-- =========================================================
-- PRODUCT PUBLICATION INDEXES
-- =========================================================

CREATE INDEX
    "RcentzProductPublication_productId_idx"
ON "RcentzProductPublication"("productId");

CREATE INDEX
    "RcentzProductPublication_type_idx"
ON "RcentzProductPublication"("type");

CREATE INDEX
    "RcentzProductPublication_featured_idx"
ON "RcentzProductPublication"("featured");

CREATE INDEX
    "RcentzProductPublication_sortOrder_idx"
ON "RcentzProductPublication"("sortOrder");

CREATE INDEX
    "RcentzProductPublication_publishedAt_idx"
ON "RcentzProductPublication"("publishedAt");

CREATE UNIQUE INDEX
    "RcentzProductPublication_productId_slug_key"
ON "RcentzProductPublication"(
    "productId",
    "slug"
);


-- =========================================================
-- PRODUCT GALLERY INDEXES
-- =========================================================

CREATE INDEX
    "RcentzProductGallery_productId_idx"
ON "RcentzProductGallery"("productId");

CREATE INDEX
    "RcentzProductGallery_type_idx"
ON "RcentzProductGallery"("type");

CREATE INDEX
    "RcentzProductGallery_featured_idx"
ON "RcentzProductGallery"("featured");

CREATE INDEX
    "RcentzProductGallery_sortOrder_idx"
ON "RcentzProductGallery"("sortOrder");

CREATE INDEX
    "RcentzProductGallery_publishedAt_idx"
ON "RcentzProductGallery"("publishedAt");

CREATE UNIQUE INDEX
    "RcentzProductGallery_productId_slug_key"
ON "RcentzProductGallery"(
    "productId",
    "slug"
);


-- =========================================================
-- PRODUCT POLICY INDEXES
-- =========================================================

CREATE INDEX
    "RcentzProductPolicy_productId_idx"
ON "RcentzProductPolicy"("productId");

CREATE INDEX
    "RcentzProductPolicy_type_idx"
ON "RcentzProductPolicy"("type");

CREATE INDEX
    "RcentzProductPolicy_isCurrent_idx"
ON "RcentzProductPolicy"("isCurrent");

CREATE INDEX
    "RcentzProductPolicy_effectiveAt_idx"
ON "RcentzProductPolicy"("effectiveAt");

CREATE INDEX
    "RcentzProductPolicy_publishedAt_idx"
ON "RcentzProductPolicy"("publishedAt");

CREATE UNIQUE INDEX
    "RcentzProductPolicy_productId_slug_version_key"
ON "RcentzProductPolicy"(
    "productId",
    "slug",
    "version"
);


-- =========================================================
-- MEDIA / PRODUCT INDEXES
-- =========================================================

CREATE INDEX
    "MediaAsset_rcentzProductGalleryId_idx"
ON "MediaAsset"("rcentzProductGalleryId");

CREATE INDEX
    "RcentzProduct_stage_idx"
ON "RcentzProduct"("stage");

CREATE INDEX
    "RcentzProduct_isReleased_idx"
ON "RcentzProduct"("isReleased");

CREATE INDEX
    "RcentzProduct_firstReleasedAt_idx"
ON "RcentzProduct"("firstReleasedAt");


-- =========================================================
-- RELATIONS
-- =========================================================

ALTER TABLE "RcentzProductUpdate"
ADD CONSTRAINT "RcentzProductUpdate_productId_fkey"
FOREIGN KEY ("productId")
REFERENCES "RcentzProduct"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;


ALTER TABLE "RcentzProductPublication"
ADD CONSTRAINT "RcentzProductPublication_productId_fkey"
FOREIGN KEY ("productId")
REFERENCES "RcentzProduct"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;


ALTER TABLE "RcentzProductGallery"
ADD CONSTRAINT "RcentzProductGallery_productId_fkey"
FOREIGN KEY ("productId")
REFERENCES "RcentzProduct"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;


ALTER TABLE "RcentzProductPolicy"
ADD CONSTRAINT "RcentzProductPolicy_productId_fkey"
FOREIGN KEY ("productId")
REFERENCES "RcentzProduct"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;


ALTER TABLE "MediaAsset"
ADD CONSTRAINT "MediaAsset_rcentzProductGalleryId_fkey"
FOREIGN KEY ("rcentzProductGalleryId")
REFERENCES "RcentzProductGallery"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;