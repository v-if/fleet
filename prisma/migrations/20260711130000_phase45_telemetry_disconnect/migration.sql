-- Phase 4.5: Telemetry 연동 해제 — lifecycle + disconnect reason

ALTER TYPE "VehicleLifecycle" ADD VALUE IF NOT EXISTS 'TELEMETRY_DISCONNECTED';

DO $$ BEGIN
  CREATE TYPE "TelemetryDisconnectReason" AS ENUM ('USER_SOFTWARE', 'VK_REMOVED_OFFLINE', 'UNLINK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "TelemetrySubscription"
  ADD COLUMN IF NOT EXISTS "disconnectedAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "disconnectReason" "TelemetryDisconnectReason";

CREATE INDEX IF NOT EXISTS "TelemetrySubscription_disconnectReason_idx"
  ON "TelemetrySubscription"("disconnectReason");
