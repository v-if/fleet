-- CreateEnum
CREATE TYPE "AuditLogStatus" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateEnum
CREATE TYPE "ApiCallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "vehicleId" TEXT,
    "teslaAccountId" TEXT,
    "requestId" TEXT,
    "status" "AuditLogStatus" NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCallLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" "ApiCallDirection" NOT NULL,
    "system" TEXT NOT NULL,
    "requestId" TEXT,
    "auditLogId" TEXT,
    "actorUserId" TEXT,
    "teslaAccountId" TEXT,
    "vehicleId" TEXT,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL,
    "durationMs" INTEGER,
    "requestHeaders" JSONB,
    "requestBody" JSONB,
    "responseHeaders" JSONB,
    "responseBody" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX "AuditLog_vehicleId_idx" ON "AuditLog"("vehicleId");
CREATE INDEX "AuditLog_teslaAccountId_idx" ON "AuditLog"("teslaAccountId");
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

CREATE INDEX "ApiCallLog_requestId_idx" ON "ApiCallLog"("requestId");
CREATE INDEX "ApiCallLog_auditLogId_idx" ON "ApiCallLog"("auditLogId");
CREATE INDEX "ApiCallLog_actorUserId_idx" ON "ApiCallLog"("actorUserId");
CREATE INDEX "ApiCallLog_teslaAccountId_idx" ON "ApiCallLog"("teslaAccountId");
CREATE INDEX "ApiCallLog_vehicleId_idx" ON "ApiCallLog"("vehicleId");
CREATE INDEX "ApiCallLog_system_idx" ON "ApiCallLog"("system");
CREATE INDEX "ApiCallLog_occurredAt_idx" ON "ApiCallLog"("occurredAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_teslaAccountId_fkey" FOREIGN KEY ("teslaAccountId") REFERENCES "TeslaAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApiCallLog" ADD CONSTRAINT "ApiCallLog_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiCallLog" ADD CONSTRAINT "ApiCallLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiCallLog" ADD CONSTRAINT "ApiCallLog_teslaAccountId_fkey" FOREIGN KEY ("teslaAccountId") REFERENCES "TeslaAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiCallLog" ADD CONSTRAINT "ApiCallLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
