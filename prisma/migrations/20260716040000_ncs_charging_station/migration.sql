-- NCS: ChargingStation catalog (nearby REST seed)
CREATE TYPE "ChargingStationSource" AS ENUM ('TESLA_NEARBY');
CREATE TYPE "ChargingStationSiteType" AS ENUM ('destination', 'supercharger');

CREATE TABLE "ChargingStation" (
    "id" TEXT NOT NULL,
    "source" "ChargingStationSource" NOT NULL DEFAULT 'TESLA_NEARBY',
    "siteType" "ChargingStationSiteType" NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "geoKey" TEXT NOT NULL,
    "totalStalls" INTEGER,
    "lastAvailableStalls" INTEGER,
    "siteClosed" BOOLEAN,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ChargingStation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChargingStation_geoKey_key" ON "ChargingStation"("geoKey");
CREATE INDEX "ChargingStation_latitude_longitude_idx" ON "ChargingStation"("latitude", "longitude");
CREATE INDEX "ChargingStation_lastSeenAt_idx" ON "ChargingStation"("lastSeenAt");
