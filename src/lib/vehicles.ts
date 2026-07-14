import { prisma } from "@/lib/prisma";
import { activeVehicleWhere } from "@/lib/vehicle-query";
import { isIdleVehicle } from "@/lib/vehicle-status";
import { getSyncMetadata } from "@/lib/vehicle-sync";
import { getVehicleProviderName } from "@/lib/vehicle-providers";
import { parseNearbyChargingJson } from "@/lib/tesla/nearby-charging";
import { isTelemetryValueMonitorEnabled } from "@/lib/tesla/telemetry/config";
import { listTelemetryMonitorLinesForVehicle } from "@/lib/tesla/telemetry/value-monitor";
import type {
  VehicleDetailDto,
  VehicleFreshnessDto,
  VehicleListItemDto,
  VehicleSyncStateDto,
  VehiclesResponse,
} from "@/lib/types/vehicle";
import type { VehicleSnapshot, VehicleSyncState } from "@prisma/client";

function serializeSnapshot(snapshot: VehicleSnapshot) {
  const nearby = parseNearbyChargingJson(snapshot.nearbyChargingSites);
  return {
    id: snapshot.id,
    vehicleId: snapshot.vehicleId,
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    batteryPercent: snapshot.batteryPercent,
    rangeKm: snapshot.rangeKm,
    ignitionOn: snapshot.ignitionOn,
    status: snapshot.status,
    chargingStatus: snapshot.chargingStatus,
    odometerKm: snapshot.odometerKm,
    chargeLimitSoc: snapshot.chargeLimitSoc ?? null,
    chargerPowerKw: snapshot.chargerPowerKw ?? null,
    shiftState: snapshot.shiftState ?? null,
    locked: snapshot.locked,
    doorsOpen: snapshot.doorsOpen,
    windowsOpen: snapshot.windowsOpen,
    doorDfOpen: snapshot.doorDfOpen ?? null,
    doorDrOpen: snapshot.doorDrOpen ?? null,
    doorPfOpen: snapshot.doorPfOpen ?? null,
    doorPrOpen: snapshot.doorPrOpen ?? null,
    frontTrunkOpen: snapshot.frontTrunkOpen ?? null,
    rearTrunkOpen: snapshot.rearTrunkOpen ?? null,
    insideTempC: snapshot.insideTempC,
    outsideTempC: snapshot.outsideTempC,
    climateOn: snapshot.climateOn,
    tpmsFrontLeft: snapshot.tpmsFrontLeft,
    tpmsFrontRight: snapshot.tpmsFrontRight,
    tpmsRearLeft: snapshot.tpmsRearLeft,
    tpmsRearRight: snapshot.tpmsRearRight,
    sentryMode: snapshot.sentryMode,
    serviceStatus: snapshot.serviceStatus,
    softwareVersion: snapshot.softwareVersion,
    nearbyChargingSites: nearby.sites,
    nearbyChargingMeta:
      nearby.capturedAt || nearby.sites.length > 0
        ? {
            capturedAt: nearby.capturedAt,
            capturedLat: nearby.capturedLat,
            capturedLng: nearby.capturedLng,
          }
        : null,
    lastTelemetryAt: snapshot.lastTelemetryAt?.toISOString() ?? null,
    lastRestSyncAt: snapshot.lastRestSyncAt?.toISOString() ?? null,
    telemetrySource: snapshot.telemetrySource,
    isAsleepInferred: snapshot.isAsleepInferred,
    sleepInferredAt: snapshot.sleepInferredAt?.toISOString() ?? null,
    lastUpdatedAt: snapshot.lastUpdatedAt.toISOString(),
    createdAt: snapshot.createdAt.toISOString(),
  };
}

function serializeSyncState(
  syncState: VehicleSyncState | null | undefined,
): VehicleSyncStateDto | null {
  if (!syncState) return null;
  return {
    lifecycle: syncState.lifecycle,
    virtualKeyConfirmedAt: syncState.virtualKeyConfirmedAt?.toISOString() ?? null,
    telemetryConfigSyncedAt:
      syncState.telemetryConfigSyncedAt?.toISOString() ?? null,
    baselineCompletedAt: syncState.baselineCompletedAt?.toISOString() ?? null,
    baselineLastError: syncState.baselineLastError,
    lastRestSyncAt: syncState.lastRestSyncAt?.toISOString() ?? null,
    lastRestSyncReason: syncState.lastRestSyncReason,
    lastWakeDetectedAt: syncState.lastWakeDetectedAt?.toISOString() ?? null,
    updatedAt: syncState.updatedAt.toISOString(),
  };
}

function buildFreshness(
  syncState: VehicleSyncState | null | undefined,
  snapshot: VehicleSnapshot | null,
): VehicleFreshnessDto {
  return {
    lastTelemetryAt: snapshot?.lastTelemetryAt?.toISOString() ?? null,
    lastRestSyncAt:
      syncState?.lastRestSyncAt?.toISOString() ??
      snapshot?.lastRestSyncAt?.toISOString() ??
      null,
    lastRestSyncReason: syncState?.lastRestSyncReason ?? null,
    telemetrySource: snapshot?.telemetrySource ?? null,
  };
}

function toListItem(
  vehicle: Awaited<ReturnType<typeof fetchVehiclesFromDb>>[number],
): VehicleListItemDto {
  const snapshot = vehicle.snapshots[0] ?? null;
  const syncState = vehicle.syncState ?? null;

  return {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    model: vehicle.model,
    year: vehicle.year,
    oemVehicleId: vehicle.oemVehicleId,
    carType: vehicle.carType,
    trimBadging: vehicle.trimBadging,
    exteriorColor: vehicle.exteriorColor,
    teslaDisplayName: vehicle.teslaDisplayName,
    specsSyncedAt: vehicle.specsSyncedAt?.toISOString() ?? null,
    syncState: serializeSyncState(syncState),
    freshness: buildFreshness(syncState, snapshot),
    snapshot: snapshot ? serializeSnapshot(snapshot) : null,
    recentEvents: vehicle.events.map((event) => ({
      id: event.id,
      vehicleId: event.vehicleId,
      type: event.type,
      message: event.message,
      occurredAt: event.occurredAt.toISOString(),
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
    isIdle: snapshot
      ? isIdleVehicle(snapshot.status, snapshot.lastUpdatedAt)
      : false,
  };
}

const vehicleListInclude = {
  snapshots: {
    orderBy: { lastUpdatedAt: "desc" as const },
    take: 1,
  },
  events: {
    orderBy: { occurredAt: "desc" as const },
    take: 3,
  },
  syncState: true,
};

async function fetchVehiclesFromDb() {
  return prisma.vehicle.findMany({
    where: activeVehicleWhere,
    include: vehicleListInclude,
    orderBy: { plateNumber: "asc" },
  });
}

export async function getVehiclesResponse(): Promise<VehiclesResponse> {
  const vehicles = await fetchVehiclesFromDb();
  const items = vehicles.map(toListItem);
  const snapshots = items
    .map((item) => item.snapshot)
    .filter((snapshot) => snapshot !== null);

  const lastUpdatedAt =
    snapshots.length > 0
      ? snapshots
          .map((snapshot) => snapshot.lastUpdatedAt)
          .sort()
          .at(-1) ?? null
      : null;

  const syncMetadata = await getSyncMetadata();
  const requestedProvider = getVehicleProviderName();
  const effectiveProvider = syncMetadata?.usedFallback
    ? "mock"
    : (syncMetadata?.provider ?? requestedProvider);

  return {
    provider: effectiveProvider,
    requestedProvider,
    count: items.length,
    lastUpdatedAt,
    sync: syncMetadata
      ? {
          lastSyncedAt: syncMetadata.lastSyncedAt?.toISOString() ?? null,
          usedFallback: syncMetadata.usedFallback,
          lastError: syncMetadata.lastError,
        }
      : null,
    summary: {
      total: items.length,
      online: snapshots.filter((snapshot) => snapshot.status === "ONLINE").length,
      warning: snapshots.filter((snapshot) => snapshot.status === "WARNING").length,
      alert: snapshots.filter((snapshot) => snapshot.status === "ALERT").length,
      offline: snapshots.filter((snapshot) => snapshot.status === "OFFLINE").length,
      asleep: snapshots.filter((snapshot) => snapshot.status === "ASLEEP").length,
      idle: items.filter((item) => item.isIdle).length,
      charging: snapshots.filter((snapshot) => snapshot.chargingStatus === "CHARGING")
        .length,
      telemetryDisconnected: items.filter(
        (item) => item.syncState?.lifecycle === "TELEMETRY_DISCONNECTED",
      ).length,
    },
    vehicles: items,
  };
}

export async function getVehicleDetail(
  id: string,
): Promise<VehicleDetailDto | null> {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id,
      ...activeVehicleWhere,
    },
    include: {
      ...vehicleListInclude,
      events: {
        orderBy: { occurredAt: "desc" },
        take: 10,
      },
      telemetrySubscription: true,
    },
  });

  if (!vehicle) return null;

  const base = toListItem(vehicle);
  const subscription = vehicle.telemetrySubscription;
  const telemetryValueMonitor = isTelemetryValueMonitorEnabled()
    ? {
        lines: await listTelemetryMonitorLinesForVehicle({
          vehicleId: vehicle.id,
          vin: vehicle.oemVehicleId,
        }),
      }
    : null;

  return {
    ...base,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
    events: vehicle.events.map((event) => ({
      id: event.id,
      vehicleId: event.vehicleId,
      type: event.type,
      message: event.message,
      occurredAt: event.occurredAt.toISOString(),
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
    telemetrySubscription: subscription
      ? {
          active: subscription.active,
          configSynced: subscription.configSynced,
          configCheckedAt: subscription.configCheckedAt?.toISOString() ?? null,
          subscribedAt: subscription.subscribedAt.toISOString(),
          disconnectedAt: subscription.disconnectedAt?.toISOString() ?? null,
          disconnectReason: subscription.disconnectReason,
          lastError: subscription.lastError,
        }
      : null,
    telemetryValueMonitor,
  };
}
