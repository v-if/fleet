-- Phase 4.4.A: Vehicle 제원 컬럼 + VehicleSyncState + TelemetrySubscription config 캐시

CREATE TYPE "VehicleLifecycle" AS ENUM ('REGISTERED', 'KEY_PENDING', 'TELEMETRY_PENDING', 'READY');
CREATE TYPE "RestSyncReason" AS ENUM ('BASELINE', 'WAKE_COOLDOWN', 'MANUAL_FALLBACK', 'SPECS_REFRESH');

ALTER TABLE "TelemetrySubscription"
  ADD COLUMN IF NOT EXISTS "configSynced" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "configCheckedAt" TIMESTAMPTZ(3);

ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS "carType" TEXT,
  ADD COLUMN IF NOT EXISTS "trimBadging" TEXT,
  ADD COLUMN IF NOT EXISTS "exteriorColor" TEXT,
  ADD COLUMN IF NOT EXISTS "teslaDisplayName" TEXT,
  ADD COLUMN IF NOT EXISTS "specsSyncedAt" TIMESTAMPTZ(3);

CREATE INDEX IF NOT EXISTS "Vehicle_carType_idx" ON "Vehicle"("carType");

CREATE TABLE IF NOT EXISTS "VehicleSyncState" (
  "vehicleId" TEXT NOT NULL,
  "lifecycle" "VehicleLifecycle" NOT NULL DEFAULT 'REGISTERED',
  "virtualKeyConfirmedAt" TIMESTAMPTZ(3),
  "telemetryConfigSyncedAt" TIMESTAMPTZ(3),
  "baselineCompletedAt" TIMESTAMPTZ(3),
  "baselineLastError" TEXT,
  "lastRestSyncAt" TIMESTAMPTZ(3),
  "lastRestSyncReason" "RestSyncReason",
  "lastWakeDetectedAt" TIMESTAMPTZ(3),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "VehicleSyncState_pkey" PRIMARY KEY ("vehicleId")
);

CREATE INDEX IF NOT EXISTS "VehicleSyncState_lifecycle_idx" ON "VehicleSyncState"("lifecycle");
CREATE INDEX IF NOT EXISTS "VehicleSyncState_lastRestSyncAt_idx" ON "VehicleSyncState"("lastRestSyncAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VehicleSyncState_vehicleId_fkey'
  ) THEN
    ALTER TABLE "VehicleSyncState"
      ADD CONSTRAINT "VehicleSyncState_vehicleId_fkey"
      FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: 활성 Telemetry 구독이 있으면 READY, 아니면 REGISTERED
-- lastRestSyncAt 은 최신 Snapshot 값을 미러링 (있으면 시 쿨다운 SoT)
INSERT INTO "VehicleSyncState" (
  "vehicleId",
  "lifecycle",
  "telemetryConfigSyncedAt",
  "baselineCompletedAt",
  "lastRestSyncAt",
  "lastRestSyncReason",
  "updatedAt"
)
SELECT
  v.id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "TelemetrySubscription" ts
      WHERE ts."vehicleId" = v.id AND ts.active = true
    ) THEN 'READY'::"VehicleLifecycle"
    ELSE 'REGISTERED'::"VehicleLifecycle"
  END,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "TelemetrySubscription" ts
      WHERE ts."vehicleId" = v.id AND ts.active = true
    ) THEN NOW()
    ELSE NULL
  END,
  (
    SELECT s."lastRestSyncAt"
    FROM "VehicleSnapshot" s
    WHERE s."vehicleId" = v.id
    ORDER BY s."lastUpdatedAt" DESC
    LIMIT 1
  ),
  (
    SELECT s."lastRestSyncAt"
    FROM "VehicleSnapshot" s
    WHERE s."vehicleId" = v.id
    ORDER BY s."lastUpdatedAt" DESC
    LIMIT 1
  ),
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "VehicleSnapshot" s
      WHERE s."vehicleId" = v.id AND s."lastRestSyncAt" IS NOT NULL
    ) THEN 'MANUAL_FALLBACK'::"RestSyncReason"
    ELSE NULL
  END,
  NOW()
FROM "Vehicle" v
WHERE NOT EXISTS (
  SELECT 1 FROM "VehicleSyncState" ss WHERE ss."vehicleId" = v.id
);

-- 활성 구독이 있으면 configSynced 힌트 true (추정)
UPDATE "TelemetrySubscription" ts
SET
  "configSynced" = true,
  "configCheckedAt" = COALESCE(ts."configCheckedAt", NOW())
WHERE ts.active = true
  AND ts."configSynced" = false;
