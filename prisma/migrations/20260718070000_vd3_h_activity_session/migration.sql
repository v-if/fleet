-- CreateEnum
CREATE TYPE "ActivitySessionKind" AS ENUM ('DRIVE', 'CHARGE');

-- CreateEnum
CREATE TYPE "ActivitySessionSource" AS ENUM ('TELEMETRY', 'DERIVED');

-- CreateTable
CREATE TABLE "VehicleActivitySession" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "ActivitySessionKind" NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "startOdometerKm" DOUBLE PRECISION,
    "endOdometerKm" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "startBatteryPercent" DOUBLE PRECISION,
    "endBatteryPercent" DOUBLE PRECISION,
    "energyAddedPercent" DOUBLE PRECISION,
    "chargingPowerKind" TEXT,
    "peakChargerPowerKw" DOUBLE PRECISION,
    "source" "ActivitySessionSource" NOT NULL DEFAULT 'TELEMETRY',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VehicleActivitySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleActivitySession_vehicleId_startedAt_idx" ON "VehicleActivitySession"("vehicleId", "startedAt");

-- CreateIndex
CREATE INDEX "VehicleActivitySession_vehicleId_kind_startedAt_idx" ON "VehicleActivitySession"("vehicleId", "kind", "startedAt");

-- CreateIndex
CREATE INDEX "VehicleActivitySession_vehicleId_endedAt_idx" ON "VehicleActivitySession"("vehicleId", "endedAt");

-- AddForeignKey
ALTER TABLE "VehicleActivitySession" ADD CONSTRAINT "VehicleActivitySession_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
