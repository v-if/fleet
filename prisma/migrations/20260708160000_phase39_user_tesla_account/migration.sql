-- Phase 3.9: User · TeslaAccount · Vehicle hierarchy

-- CreateEnum
CREATE TYPE "TeslaAccountRole" AS ENUM ('OWNER', 'DRIVER');

-- CreateTable
CREATE TABLE "TeslaAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teslaEmail" TEXT NOT NULL DEFAULT 'linked@tesla.local',
    "region" TEXT NOT NULL DEFAULT 'na',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "role" "TeslaAccountRole",
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeslaAccount_pkey" PRIMARY KEY ("id")
);

-- AlterTable Vehicle
ALTER TABLE "Vehicle" ADD COLUMN "teslaAccountId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "unlinkedAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- Drop global unique on oemVehicleId (composite unique replaces it per account)
DROP INDEX IF EXISTS "Vehicle_oemVehicleId_key";

-- Ensure default FMS user exists
INSERT INTO "User" ("id", "email", "name", "createdAt", "updatedAt")
SELECT
    'default-fms-user',
    'admin@fleet.local',
    'Fleet Admin',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "User" WHERE "email" = 'admin@fleet.local'
);

-- Migrate TeslaOAuthToken rows into TeslaAccount
INSERT INTO "TeslaAccount" (
    "id",
    "userId",
    "teslaEmail",
    "region",
    "accessToken",
    "refreshToken",
    "expiresAt",
    "scope",
    "role",
    "linkedAt",
    "unlinkedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    t."id",
    u."id",
    'linked@tesla.local',
    'na',
    t."accessToken",
    t."refreshToken",
    t."expiresAt",
    t."scope",
    'OWNER'::"TeslaAccountRole",
    t."createdAt",
    NULL,
    t."createdAt",
    t."updatedAt"
FROM "TeslaOAuthToken" t
CROSS JOIN LATERAL (
    SELECT "id" FROM "User" WHERE "email" = 'admin@fleet.local' LIMIT 1
) u;

-- Link Tesla-synced vehicles to the migrated account
UPDATE "Vehicle" v
SET "teslaAccountId" = ta."id"
FROM "TeslaAccount" ta
WHERE v."oemVehicleId" IS NOT NULL
  AND v."teslaAccountId" IS NULL
  AND ta."unlinkedAt" IS NULL;

-- Drop legacy token table
DROP TABLE "TeslaOAuthToken";

-- CreateIndex
CREATE UNIQUE INDEX "TeslaAccount_userId_teslaEmail_key" ON "TeslaAccount"("userId", "teslaEmail");
CREATE INDEX "TeslaAccount_userId_idx" ON "TeslaAccount"("userId");
CREATE INDEX "TeslaAccount_unlinkedAt_idx" ON "TeslaAccount"("unlinkedAt");

CREATE UNIQUE INDEX "Vehicle_teslaAccountId_oemVehicleId_key" ON "Vehicle"("teslaAccountId", "oemVehicleId");
CREATE INDEX "Vehicle_teslaAccountId_idx" ON "Vehicle"("teslaAccountId");
CREATE INDEX "Vehicle_unlinkedAt_idx" ON "Vehicle"("unlinkedAt");

-- AddForeignKey
ALTER TABLE "TeslaAccount" ADD CONSTRAINT "TeslaAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_teslaAccountId_fkey" FOREIGN KEY ("teslaAccountId") REFERENCES "TeslaAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
