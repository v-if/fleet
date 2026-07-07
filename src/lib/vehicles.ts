import type { VehicleSnapshot } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isIdleVehicle } from "@/lib/vehicle-status";
import { getSyncMetadata } from "@/lib/vehicle-sync";
import { getVehicleProviderName } from "@/lib/vehicle-providers";
import type { NearbyChargingSiteDto } from "@/lib/types/vehicle";
import type {
  VehicleDetailDto,
  VehicleListItemDto,
  VehiclesResponse,
} from "@/lib/types/vehicle";

function parseNearbyChargingSites(json: string | null): NearbyChargingSiteDto[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as NearbyChargingSiteDto[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeSnapshot(snapshot: VehicleSnapshot) {
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
    locked: snapshot.locked,
    doorsOpen: snapshot.doorsOpen,
    windowsOpen: snapshot.windowsOpen,
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
    nearbyChargingSites: parseNearbyChargingSites(snapshot.nearbyChargingSites),
    lastUpdatedAt: snapshot.lastUpdatedAt.toISOString(),
    createdAt: snapshot.createdAt.toISOString(),
  };
}

function toListItem(
  vehicle: Awaited<ReturnType<typeof fetchVehiclesFromDb>>[number],
): VehicleListItemDto {
  const snapshot = vehicle.snapshots[0] ?? null;

  return {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    model: vehicle.model,
    year: vehicle.year,
    oemVehicleId: vehicle.oemVehicleId,
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

async function fetchVehiclesFromDb() {
  return prisma.vehicle.findMany({
    include: {
      snapshots: {
        orderBy: { lastUpdatedAt: "desc" },
        take: 1,
      },
      events: {
        orderBy: { occurredAt: "desc" },
        take: 3,
      },
    },
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
      idle: items.filter((item) => item.isIdle).length,
      charging: snapshots.filter((snapshot) => snapshot.chargingStatus === "CHARGING")
        .length,
    },
    vehicles: items,
  };
}

export async function getVehicleDetail(
  id: string,
): Promise<VehicleDetailDto | null> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      snapshots: {
        orderBy: { lastUpdatedAt: "desc" },
        take: 1,
      },
      events: {
        orderBy: { occurredAt: "desc" },
        take: 10,
      },
    },
  });

  if (!vehicle) return null;

  const base = toListItem(vehicle);

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
  };
}
