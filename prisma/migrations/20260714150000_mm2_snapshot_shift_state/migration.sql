-- Phase MM2: VehicleSnapshot.shiftState (P|R|N|D)
ALTER TABLE "VehicleSnapshot" ADD COLUMN IF NOT EXISTS "shiftState" TEXT;
