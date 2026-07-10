-- Phase 4.2: Tesla Fleet Telemetry

-- AlterEnum: add ASLEEP to VehicleStatus
ALTER TYPE "VehicleStatus" ADD VALUE IF NOT EXISTS 'ASLEEP' AFTER 'OFFLINE';

-- CreateEnum
CREATE TYPE "TelemetryIngressStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE');
CREATE TYPE "TelemetrySource" AS ENUM ('TELEMETRY', 'REST', 'MIXED');

-- CreateTable TelemetryMetadata
CREATE TABLE "TelemetryMetadata" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastReceivedAt" TIMESTAMPTZ(3),
    "lastProcessedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "pendingIngressCount" INTEGER NOT NULL DEFAULT 0,
    "subscriptionCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TelemetryMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable TelemetryIngress
CREATE TABLE "TelemetryIngress" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "vin" TEXT,
    "vehicleId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "TelemetryIngressStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryIngress_pkey" PRIMARY KEY ("id")
);

-- CreateTable TelemetrySubscription
CREATE TABLE "TelemetrySubscription" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "teslaAccountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TelemetrySubscription_pkey" PRIMARY KEY ("id")
);

-- AlterTable VehicleSnapshot
ALTER TABLE "VehicleSnapshot"
ADD COLUMN "lastTelemetryAt" TIMESTAMPTZ(3),
ADD COLUMN "lastRestSyncAt" TIMESTAMPTZ(3),
ADD COLUMN "telemetrySource" "TelemetrySource",
ADD COLUMN "isAsleepInferred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sleepInferredAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "TelemetryIngress_idempotencyKey_key" ON "TelemetryIngress"("idempotencyKey");
CREATE INDEX "TelemetryIngress_status_receivedAt_idx" ON "TelemetryIngress"("status", "receivedAt");
CREATE INDEX "TelemetryIngress_vin_idx" ON "TelemetryIngress"("vin");
CREATE INDEX "TelemetryIngress_vehicleId_idx" ON "TelemetryIngress"("vehicleId");
CREATE UNIQUE INDEX "TelemetrySubscription_vehicleId_key" ON "TelemetrySubscription"("vehicleId");
CREATE INDEX "TelemetrySubscription_vin_idx" ON "TelemetrySubscription"("vin");
CREATE INDEX "TelemetrySubscription_teslaAccountId_idx" ON "TelemetrySubscription"("teslaAccountId");
CREATE INDEX "TelemetrySubscription_active_idx" ON "TelemetrySubscription"("active");
CREATE INDEX "VehicleSnapshot_lastTelemetryAt_idx" ON "VehicleSnapshot"("lastTelemetryAt");

-- AddForeignKey
ALTER TABLE "TelemetryIngress" ADD CONSTRAINT "TelemetryIngress_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelemetrySubscription" ADD CONSTRAINT "TelemetrySubscription_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelemetrySubscription" ADD CONSTRAINT "TelemetrySubscription_teslaAccountId_fkey" FOREIGN KEY ("teslaAccountId") REFERENCES "TeslaAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default telemetry metadata row
INSERT INTO "TelemetryMetadata" ("id", "enabled", "pendingIngressCount", "subscriptionCount", "updatedAt")
VALUES ('default', true, 0, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
