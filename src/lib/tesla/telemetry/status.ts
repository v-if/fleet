import { TelemetryIngressStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { activeVehicleWhere } from "@/lib/vehicle-query";

import {
  getTelemetryWebhookUrl,
  isRestAutoSyncEnabled,
  isRestFreezeEnabled,
  isTelemetryEnabled,
  isTelemetryPrimaryMode,
} from "./config";

export async function getTelemetryOperationalStatus() {
  const [
    metadata,
    ingressByStatus,
    recentIngress,
    subscriptionCount,
    registeredVehicles,
    telemetrySnapshots,
  ] = await Promise.all([
    prisma.telemetryMetadata.findUnique({ where: { id: "default" } }),
    prisma.telemetryIngress.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.telemetryIngress.findMany({
      orderBy: { receivedAt: "desc" },
      take: 10,
      select: {
        id: true,
        vin: true,
        status: true,
        receivedAt: true,
        processedAt: true,
        errorMessage: true,
      },
    }),
    prisma.telemetrySubscription.count({ where: { active: true } }),
    prisma.vehicle.findMany({
      where: {
        ...activeVehicleWhere,
        oemVehicleId: { not: null },
        telemetrySubscription: { is: { active: true } },
      },
      select: {
        id: true,
        plateNumber: true,
        oemVehicleId: true,
        carType: true,
        specsSyncedAt: true,
        syncState: {
          select: {
            lifecycle: true,
            baselineCompletedAt: true,
            baselineLastError: true,
            lastRestSyncAt: true,
            lastRestSyncReason: true,
            lastWakeDetectedAt: true,
          },
        },
        snapshots: {
          orderBy: { lastUpdatedAt: "desc" },
          take: 1,
          select: {
            telemetrySource: true,
            lastTelemetryAt: true,
            lastUpdatedAt: true,
            lastRestSyncAt: true,
          },
        },
      },
      orderBy: { plateNumber: "asc" },
    }),
    prisma.vehicleSnapshot.count({
      where: { telemetrySource: "TELEMETRY" },
    }),
  ]);

  const ingressCounts = Object.fromEntries(
    ingressByStatus.map((row) => [row.status, row._count._all]),
  ) as Partial<Record<TelemetryIngressStatus, number>>;

  return {
    config: {
      telemetryEnabled: isTelemetryEnabled(),
      telemetryPrimaryMode: isTelemetryPrimaryMode(),
      restAutoSync: isRestAutoSyncEnabled(),
      restFreeze: isRestFreezeEnabled(),
      webhookUrl: getTelemetryWebhookUrl(),
    },
    metadata: metadata
      ? {
          lastReceivedAt: metadata.lastReceivedAt?.toISOString() ?? null,
          lastProcessedAt: metadata.lastProcessedAt?.toISOString() ?? null,
          lastError: metadata.lastError,
          pendingIngressCount: metadata.pendingIngressCount,
          subscriptionCount: metadata.subscriptionCount,
        }
      : null,
    ingress: {
      counts: ingressCounts,
      recent: recentIngress.map((row) => ({
        id: row.id,
        vin: row.vin,
        status: row.status,
        receivedAt: row.receivedAt.toISOString(),
        processedAt: row.processedAt?.toISOString() ?? null,
        errorMessage: row.errorMessage,
      })),
    },
    vehicles: {
      registeredCount: registeredVehicles.length,
      activeSubscriptionCount: subscriptionCount,
      telemetrySnapshotCount: telemetrySnapshots,
      lifecycleCounts: registeredVehicles.reduce(
        (acc, vehicle) => {
          const key = vehicle.syncState?.lifecycle ?? "UNKNOWN";
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      items: registeredVehicles.map((vehicle) => ({
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        vin: vehicle.oemVehicleId,
        carType: vehicle.carType,
        specsSyncedAt: vehicle.specsSyncedAt?.toISOString() ?? null,
        lifecycle: vehicle.syncState?.lifecycle ?? null,
        baselineCompletedAt:
          vehicle.syncState?.baselineCompletedAt?.toISOString() ?? null,
        baselineLastError: vehicle.syncState?.baselineLastError ?? null,
        lastRestSyncAt:
          vehicle.syncState?.lastRestSyncAt?.toISOString() ??
          vehicle.snapshots[0]?.lastRestSyncAt?.toISOString() ??
          null,
        lastRestSyncReason: vehicle.syncState?.lastRestSyncReason ?? null,
        lastWakeDetectedAt:
          vehicle.syncState?.lastWakeDetectedAt?.toISOString() ?? null,
        latestTelemetryAt:
          vehicle.snapshots[0]?.lastTelemetryAt?.toISOString() ??
          vehicle.snapshots[0]?.lastUpdatedAt?.toISOString() ??
          null,
        telemetrySource: vehicle.snapshots[0]?.telemetrySource ?? null,
      })),
    },
    hints: buildHints({
      telemetryEnabled: isTelemetryEnabled(),
      telemetryPrimaryMode: isTelemetryPrimaryMode(),
      lastReceivedAt: metadata?.lastReceivedAt ?? null,
      registeredCount: registeredVehicles.length,
      pendingCount: metadata?.pendingIngressCount ?? 0,
      failedCount: ingressCounts.FAILED ?? 0,
    }),
  };
}

function buildHints(input: {
  telemetryEnabled: boolean;
  telemetryPrimaryMode: boolean;
  lastReceivedAt: Date | null;
  registeredCount: number;
  pendingCount: number;
  failedCount: number;
}) {
  const hints: string[] = [];

  if (!input.telemetryEnabled) {
    hints.push("TESLA_TELEMETRY_ENABLED=false — webhook 수신이 비활성화되어 있습니다.");
  }

  if (input.telemetryPrimaryMode) {
    hints.push(
      "Telemetry primary 모드 — VehicleSnapshot은 webhook 수신으로만 갱신됩니다.",
    );
  }

  if (!input.lastReceivedAt) {
    hints.push(
      "아직 webhook 수신 기록이 없습니다. Telemetry 서버 relay 또는 scripts/telemetry-webhook-check.ps1 로 테스트하세요.",
    );
  }

  if (input.registeredCount === 0) {
    hints.push("등록된 Tesla VIN이 없습니다. OAuth 연결 후 차량 목록 동기화가 필요합니다.");
  }

  if (input.pendingCount > 0) {
    hints.push(
      `처리 대기 ingress ${input.pendingCount}건 — POST /api/internal/telemetry/process 실행을 고려하세요.`,
    );
  }

  if (input.failedCount > 0) {
    hints.push(
      `실패 ingress ${input.failedCount}건 — VIN이 Vehicle.oemVehicleId와 일치하는지 payload를 확인하세요.`,
    );
  }

  return hints;
}
