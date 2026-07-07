-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ONLINE', 'OFFLINE', 'WARNING', 'ALERT');

-- CreateEnum
CREATE TYPE "ChargingStatus" AS ENUM ('CHARGING', 'COMPLETE', 'DISCONNECTED', 'STOPPED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('OK', 'DUE_SOON', 'IN_SERVICE');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('ALERT', 'WARNING', 'IDLE', 'OFFLINE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeslaOAuthToken" (
    "id" TEXT NOT NULL,
    "accountKey" TEXT NOT NULL DEFAULT 'default',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeslaOAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncMetadata" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "lastSyncedAt" TIMESTAMP(3),
    "provider" TEXT,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "oemVehicleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSnapshot" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "batteryPercent" DOUBLE PRECISION,
    "rangeKm" DOUBLE PRECISION,
    "ignitionOn" BOOLEAN NOT NULL DEFAULT false,
    "status" "VehicleStatus" NOT NULL DEFAULT 'OFFLINE',
    "chargingStatus" "ChargingStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "odometerKm" DOUBLE PRECISION,
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "doorsOpen" BOOLEAN NOT NULL DEFAULT false,
    "windowsOpen" BOOLEAN NOT NULL DEFAULT false,
    "insideTempC" DOUBLE PRECISION,
    "outsideTempC" DOUBLE PRECISION,
    "climateOn" BOOLEAN NOT NULL DEFAULT false,
    "tpmsFrontLeft" DOUBLE PRECISION,
    "tpmsFrontRight" DOUBLE PRECISION,
    "tpmsRearLeft" DOUBLE PRECISION,
    "tpmsRearRight" DOUBLE PRECISION,
    "sentryMode" BOOLEAN NOT NULL DEFAULT false,
    "serviceStatus" "ServiceStatus" NOT NULL DEFAULT 'OK',
    "softwareVersion" TEXT,
    "nearbyChargingSites" TEXT,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleEvent" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "message" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TeslaOAuthToken_accountKey_key" ON "TeslaOAuthToken"("accountKey");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_oemVehicleId_key" ON "Vehicle"("oemVehicleId");

-- CreateIndex
CREATE INDEX "VehicleSnapshot_vehicleId_idx" ON "VehicleSnapshot"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleSnapshot_lastUpdatedAt_idx" ON "VehicleSnapshot"("lastUpdatedAt");

-- CreateIndex
CREATE INDEX "VehicleEvent_vehicleId_idx" ON "VehicleEvent"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleEvent_occurredAt_idx" ON "VehicleEvent"("occurredAt");

-- AddForeignKey
ALTER TABLE "VehicleSnapshot" ADD CONSTRAINT "VehicleSnapshot_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleEvent" ADD CONSTRAINT "VehicleEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
