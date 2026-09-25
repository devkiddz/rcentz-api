/*
  Warnings:

  - A unique constraint covering the columns `[rcentzProductId]` on the table `SeoMetadata` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RcentzProductStatus" AS ENUM ('DRAFT', 'DEVELOPMENT', 'COMING_SOON', 'BETA', 'PUBLISHED', 'PAUSED', 'RETIRED');

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "rcentzProductId" TEXT;

-- AlterTable
ALTER TABLE "SeoMetadata" ADD COLUMN     "rcentzProductId" TEXT;

-- CreateTable
CREATE TABLE "RcentzProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "status" "RcentzProductStatus" NOT NULL DEFAULT 'DRAFT',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "productUrl" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "betaAvailable" BOOLEAN NOT NULL DEFAULT false,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "expectedLaunchAt" TIMESTAMP(3),
    "launchedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RcentzProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RcentzProduct_slug_key" ON "RcentzProduct"("slug");

-- CreateIndex
CREATE INDEX "RcentzProduct_status_idx" ON "RcentzProduct"("status");

-- CreateIndex
CREATE INDEX "RcentzProduct_featured_idx" ON "RcentzProduct"("featured");

-- CreateIndex
CREATE INDEX "RcentzProduct_visible_idx" ON "RcentzProduct"("visible");

-- CreateIndex
CREATE INDEX "RcentzProduct_sortOrder_idx" ON "RcentzProduct"("sortOrder");

-- CreateIndex
CREATE INDEX "RcentzProduct_publishedAt_idx" ON "RcentzProduct"("publishedAt");

-- CreateIndex
CREATE INDEX "MediaAsset_rcentzProductId_idx" ON "MediaAsset"("rcentzProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoMetadata_rcentzProductId_key" ON "SeoMetadata"("rcentzProductId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_rcentzProductId_fkey" FOREIGN KEY ("rcentzProductId") REFERENCES "RcentzProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoMetadata" ADD CONSTRAINT "SeoMetadata_rcentzProductId_fkey" FOREIGN KEY ("rcentzProductId") REFERENCES "RcentzProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
