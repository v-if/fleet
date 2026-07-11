-- Phase VD-3: charge detail, individual doors/trunks on VehicleSnapshot
ALTER TABLE "VehicleSnapshot" ADD COLUMN IF NOT EXISTS "chargeLimitSoc" DOUBLE PRECISION;
ALTER TABLE "VehicleSnapshot" ADD COLUMN IF NOT EXISTS "chargerPowerKw" DOUBLE PRECISION;
ALTER TABLE "VehicleSnapshot" ADD COLUMN IF NOT EXISTS "doorDfOpen" BOOLEAN;
ALTER TABLE "VehicleSnapshot" ADD COLUMN IF NOT EXISTS "doorDrOpen" BOOLEAN;
ALTER TABLE "VehicleSnapshot" ADD COLUMN IF NOT EXISTS "doorPfOpen" BOOLEAN;
ALTER TABLE "VehicleSnapshot" ADD COLUMN IF NOT EXISTS "doorPrOpen" BOOLEAN;
ALTER TABLE "VehicleSnapshot" ADD COLUMN IF NOT EXISTS "frontTrunkOpen" BOOLEAN;
ALTER TABLE "VehicleSnapshot" ADD COLUMN IF NOT EXISTS "rearTrunkOpen" BOOLEAN;
