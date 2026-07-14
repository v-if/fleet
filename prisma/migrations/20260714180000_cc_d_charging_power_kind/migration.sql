-- Phase CC-D: VehicleSnapshot.chargingPowerKind (AC|DC)
ALTER TABLE "VehicleSnapshot" ADD COLUMN IF NOT EXISTS "chargingPowerKind" TEXT;
