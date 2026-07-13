/**
 * FMS 온보딩 E2E용 DB 리셋
 *
 * 유지(운영 필수):
 *   - User (FMS 로그인 — Supabase Auth 매핑)
 *   - SyncMetadata / TelemetryMetadata 행 (카운터만 리셋)
 *   - env·Partner Register·Proxy·Telemetry 서버·Supabase Auth 계정 (DB 밖)
 *
 * 삭제:
 *   - TeslaAccount, Vehicle(+SyncState/Snapshot/Event), TelemetrySubscription/Ingress
 *   - AuditLog, ApiCallLog
 *
 * Tesla 측 (선택, --unsubscribe):
 *   - 실차 VIN에 대해 fleet_telemetry_config DELETE 시도 (파트너/유저 토큰)
 *   - Virtual Key는 Tesla 앱에서 사용자가 직접 제거해야 함
 *
 * Usage:
 *   node --env-file=.env scripts/reset-fms-data.mjs --dry-run
 *   node --env-file=.env scripts/reset-fms-data.mjs --confirm --unsubscribe
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const confirm = args.has("--confirm");
const doUnsubscribe = args.has("--unsubscribe");

function isVirtualVin(vin) {
  return !vin || /VIRTUAL/i.test(vin);
}

async function tryUnsubscribeVin(vin, accessToken, partnerToken) {
  const region = process.env.TESLA_FLEET_API_REGION || "na";
  const bases = {
    na: "https://fleet-api.prd.na.vn.cloud.tesla.com",
    eu: "https://fleet-api.prd.eu.vn.cloud.tesla.com",
    cn: "https://fleet-api.prd.cn.vn.cloud.tesla.cn",
  };
  const baseUrl = bases[region] || bases.na;
  const path = `/api/1/vehicles/${encodeURIComponent(vin)}/fleet_telemetry_config`;
  const token = partnerToken || accessToken;
  if (!token) {
    return { ok: false, skipped: true, error: "no_token" };
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (response.ok || response.status === 404) {
    return { ok: true, statusCode: response.status };
  }
  const text = await response.text();
  return { ok: false, statusCode: response.status, error: text.slice(0, 300) };
}

async function main() {
  if (!dryRun && !confirm) {
    console.error(
      "거부: 실삭제에는 --confirm 이 필요합니다.\n" +
        "  미리보기: node --env-file=.env scripts/reset-fms-data.mjs --dry-run\n" +
        "  실행:     node --env-file=.env scripts/reset-fms-data.mjs --confirm --unsubscribe",
    );
    process.exitCode = 1;
    return;
  }

  const dbHost = (process.env.DATABASE_URL || "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`DB host: ${dbHost}`);
  console.log(`mode: ${dryRun ? "DRY-RUN" : "DELETE"} | unsubscribe: ${doUnsubscribe}`);

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  });
  console.log("Keeping users:", users);

  const vehicles = await prisma.vehicle.findMany({
    select: {
      id: true,
      oemVehicleId: true,
      plateNumber: true,
      teslaAccount: { select: { accessToken: true, teslaEmail: true } },
    },
  });

  const partnerToken = process.env.TESLA_PARTNER_TOKEN?.trim() || null;
  const unsubscribeResults = [];

  if (doUnsubscribe) {
    for (const vehicle of vehicles) {
      const vin = vehicle.oemVehicleId;
      if (isVirtualVin(vin)) {
        unsubscribeResults.push({ vin, skipped: true, reason: "virtual" });
        continue;
      }
      if (dryRun) {
        unsubscribeResults.push({
          vin,
          dryRun: true,
          wouldCall: true,
          hasUserToken: Boolean(vehicle.teslaAccount?.accessToken),
          hasPartnerToken: Boolean(partnerToken),
        });
        continue;
      }
      const result = await tryUnsubscribeVin(
        vin,
        vehicle.teslaAccount?.accessToken,
        partnerToken,
      );
      unsubscribeResults.push({ vin, ...result });
      console.log(`unsubscribe ${vin}:`, result);
    }
  }

  const before = {
    User: await prisma.user.count(),
    TeslaAccount: await prisma.teslaAccount.count(),
    Vehicle: await prisma.vehicle.count(),
    VehicleSyncState: await prisma.vehicleSyncState.count(),
    VehicleSnapshot: await prisma.vehicleSnapshot.count(),
    VehicleEvent: await prisma.vehicleEvent.count(),
    TelemetrySubscription: await prisma.telemetrySubscription.count(),
    TelemetryIngress: await prisma.telemetryIngress.count(),
    AuditLog: await prisma.auditLog.count(),
    ApiCallLog: await prisma.apiCallLog.count(),
  };

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          before,
          wouldDelete: {
            TeslaAccount: before.TeslaAccount,
            Vehicle: before.Vehicle,
            VehicleSyncState: before.VehicleSyncState,
            VehicleSnapshot: before.VehicleSnapshot,
            VehicleEvent: before.VehicleEvent,
            TelemetrySubscription: before.TelemetrySubscription,
            TelemetryIngress: before.TelemetryIngress,
            AuditLog: before.AuditLog,
            ApiCallLog: before.ApiCallLog,
          },
          keep: { User: before.User, users },
          unsubscribeResults,
          vehiclesPreview: vehicles.map((v) => ({
            plate: v.plateNumber,
            vin: v.oemVehicleId,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const deleted = {};
  deleted.ApiCallLog = (await prisma.apiCallLog.deleteMany({})).count;
  deleted.AuditLog = (await prisma.auditLog.deleteMany({})).count;
  deleted.TelemetryIngress = (await prisma.telemetryIngress.deleteMany({})).count;
  deleted.TelemetrySubscription = (
    await prisma.telemetrySubscription.deleteMany({})
  ).count;
  deleted.VehicleEvent = (await prisma.vehicleEvent.deleteMany({})).count;
  deleted.VehicleSnapshot = (await prisma.vehicleSnapshot.deleteMany({})).count;
  deleted.VehicleSyncState = (await prisma.vehicleSyncState.deleteMany({})).count;
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
    VehicleSyncState: await prisma.vehicleSyncState.count(),
    VehicleSnapshot: await prisma.vehicleSnapshot.count(),
    VehicleEvent: await prisma.vehicleEvent.count(),
    TelemetrySubscription: await prisma.telemetrySubscription.count(),
    TelemetryIngress: await prisma.telemetryIngress.count(),
    TelemetryMetadata: await prisma.telemetryMetadata.count(),
    SyncMetadata: await prisma.syncMetadata.count(),
    AuditLog: await prisma.auditLog.count(),
    ApiCallLog: await prisma.apiCallLog.count(),
  };

  console.log(
    JSON.stringify(
      { deleted, after, keptUsers: users, unsubscribeResults },
      null,
      2,
    ),
  );
  console.log("\n다음: FMS 로그인 → Tesla OAuth → VK → Telemetry 수신 E2E");
  console.log("가이드: docs/checklist-onboarding-e2e-reset.md");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
