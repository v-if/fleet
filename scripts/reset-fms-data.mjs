/**
 * FMS DB 초기화 — 로그인 User만 유지, 연동/차량/로그 데이터 삭제
 * 유지: User, SyncMetadata(리셋), TelemetryMetadata(리셋)
 * 삭제: TeslaAccount, Vehicle(+스냅샷/이벤트), Telemetry*, Audit/Api 로그
 *
 * Usage: node --env-file=.env scripts/reset-fms-data.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  });
  console.log("Keeping users:", users);

  const deleted = {};

  deleted.ApiCallLog = (await prisma.apiCallLog.deleteMany({})).count;
  deleted.AuditLog = (await prisma.auditLog.deleteMany({})).count;
  deleted.TelemetryIngress = (await prisma.telemetryIngress.deleteMany({})).count;
  deleted.TelemetrySubscription = (await prisma.telemetrySubscription.deleteMany({})).count;
  deleted.VehicleEvent = (await prisma.vehicleEvent.deleteMany({})).count;
  deleted.VehicleSnapshot = (await prisma.vehicleSnapshot.deleteMany({})).count;
  deleted.Vehicle = (await prisma.vehicle.deleteMany({})).count;
  deleted.TeslaAccount = (await prisma.teslaAccount.deleteMany({})).count;

  await prisma.syncMetadata.upsert({
    where: { id: "default" },
    update: {
      lastSyncedAt: null,
      provider: null,
      usedFallback: false,
      lastError: null,
    },
    create: {
      id: "default",
      lastSyncedAt: null,
      provider: null,
      usedFallback: false,
      lastError: null,
    },
  });

  await prisma.telemetryMetadata.upsert({
    where: { id: "default" },
    update: {
      enabled: true,
      lastReceivedAt: null,
      lastProcessedAt: null,
      lastError: null,
      pendingIngressCount: 0,
      subscriptionCount: 0,
    },
    create: {
      id: "default",
      enabled: true,
      lastReceivedAt: null,
      lastProcessedAt: null,
      lastError: null,
      pendingIngressCount: 0,
      subscriptionCount: 0,
    },
  });

  const after = {
    User: await prisma.user.count(),
    TeslaAccount: await prisma.teslaAccount.count(),
    Vehicle: await prisma.vehicle.count(),
    VehicleSnapshot: await prisma.vehicleSnapshot.count(),
    VehicleEvent: await prisma.vehicleEvent.count(),
    TelemetryIngress: await prisma.telemetryIngress.count(),
    TelemetrySubscription: await prisma.telemetrySubscription.count(),
    TelemetryMetadata: await prisma.telemetryMetadata.count(),
    SyncMetadata: await prisma.syncMetadata.count(),
    AuditLog: await prisma.auditLog.count(),
    ApiCallLog: await prisma.apiCallLog.count(),
  };

  console.log(JSON.stringify({ deleted, after, keptUsers: users }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
