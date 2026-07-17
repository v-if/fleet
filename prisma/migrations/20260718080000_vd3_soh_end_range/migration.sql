-- AlterTable
ALTER TABLE "VehicleActivitySession" ADD COLUMN "endRangeKm" DOUBLE PRECISION,
ADD COLUMN "endChargeLimitSoc" DOUBLE PRECISION,
ADD COLUMN "sohSampleEligible" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "VehicleActivitySession_vehicleId_sohSampleEligible_endedAt_idx" ON "VehicleActivitySession"("vehicleId", "sohSampleEligible", "endedAt");
