-- Remove placeholder/default-only storage for TeslaAccount and VehicleSnapshot.
ALTER TABLE "TeslaAccount"
  ALTER COLUMN "teslaEmail" DROP NOT NULL,
  ALTER COLUMN "teslaEmail" DROP DEFAULT,
  ALTER COLUMN "region" DROP NOT NULL,
  ALTER COLUMN "region" DROP DEFAULT;

ALTER TABLE "VehicleSnapshot"
  ALTER COLUMN "latitude" DROP NOT NULL,
  ALTER COLUMN "longitude" DROP NOT NULL,
  ALTER COLUMN "ignitionOn" DROP NOT NULL,
  ALTER COLUMN "ignitionOn" DROP DEFAULT,
  ALTER COLUMN "status" DROP NOT NULL,
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "chargingStatus" DROP NOT NULL,
  ALTER COLUMN "chargingStatus" DROP DEFAULT,
  ALTER COLUMN "locked" DROP NOT NULL,
  ALTER COLUMN "locked" DROP DEFAULT,
  ALTER COLUMN "doorsOpen" DROP NOT NULL,
  ALTER COLUMN "doorsOpen" DROP DEFAULT,
  ALTER COLUMN "windowsOpen" DROP NOT NULL,
  ALTER COLUMN "windowsOpen" DROP DEFAULT,
  ALTER COLUMN "climateOn" DROP NOT NULL,
  ALTER COLUMN "climateOn" DROP DEFAULT,
  ALTER COLUMN "sentryMode" DROP NOT NULL,
  ALTER COLUMN "sentryMode" DROP DEFAULT,
  ALTER COLUMN "serviceStatus" DROP NOT NULL,
  ALTER COLUMN "serviceStatus" DROP DEFAULT;

UPDATE "TeslaAccount"
SET "teslaEmail" = NULL
WHERE "teslaEmail" = 'linked@tesla.local';

UPDATE "VehicleSnapshot"
SET
  "latitude" = NULL
WHERE "latitude" = 0;

UPDATE "VehicleSnapshot"
SET
  "longitude" = NULL
WHERE "longitude" = 0;
