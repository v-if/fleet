import {
  getActiveTeslaAccountForUser,
  getAnyActiveTeslaAccount,
} from "@/lib/tesla/auth";
import { prisma } from "@/lib/prisma";
import { activeVehicleWhere } from "@/lib/vehicle-query";
import {
  createVehicleProvider,
  getVehicleProviderName,
} from "@/lib/vehicle-providers";
import type { VehicleEventData, VehicleSnapshotData } from "@/lib/vehicle-providers/types";
import { TeslaVehicleProvider } from "@/lib/vehicle-providers/tesla-provider";

export type SyncVehiclesResult = {
  provider: string;
  usedFallback: boolean;
  vehicleCount: number;
  eventCount: number;
  lastSyncedAt: string;
  error?: string;
};

type UpsertSnapshotOptions = {
  teslaAccountId?: string | null;
};

async function upsertSnapshot(
  snapshot: VehicleSnapshotData,
  options: UpsertSnapshotOptions = {},
) {
  const { teslaAccountId = null } = options;

  const existing =
    teslaAccountId && snapshot.oemVehicleId
      ? await prisma.vehicle.findFirst({
          where: {
            teslaAccountId,
            oemVehicleId: snapshot.oemVehicleId,
          },
        })
      : null;

  const vehicle = existing
    ? await prisma.vehicle.update({
        where: { id: existing.id },
        data: {
          plateNumber: snapshot.plateNumber,
          model: snapshot.model,
          year: snapshot.year,
          oemVehicleId: snapshot.oemVehicleId,
          teslaAccountId,
          unlinkedAt: null,
          isDeleted: false,
        },
      })
    : await prisma.vehicle.upsert({
        where: { plateNumber: snapshot.plateNumber },
        update: {
          model: snapshot.model,
          year: snapshot.year,
          oemVehicleId: snapshot.oemVehicleId,
          teslaAccountId,
          unlinkedAt: null,
          isDeleted: false,
        },
        create: {
          plateNumber: snapshot.plateNumber,
          model: snapshot.model,
          year: snapshot.year,
          oemVehicleId: snapshot.oemVehicleId,
          teslaAccountId,
        },
      });

  await prisma.vehicleSnapshot.create({
    data: {
      vehicleId: vehicle.id,
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
      nearbyChargingSites: snapshot.nearbyChargingSites
        ? JSON.stringify(snapshot.nearbyChargingSites)
        : null,
      lastUpdatedAt: snapshot.lastUpdatedAt,
    },
  });

  return vehicle;
}

async function replaceEvents(events: VehicleEventData[]) {
  await prisma.vehicleEvent.deleteMany({
    where: {
      vehicle: activeVehicleWhere,
    },
  });

  for (const event of events) {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        plateNumber: event.plateNumber,
        ...activeVehicleWhere,
      },
    });
    if (!vehicle) continue;

    await prisma.vehicleEvent.create({
      data: {
        vehicleId: vehicle.id,
        type: event.type,
        message: event.message,
        occurredAt: event.occurredAt,
      },
    });
  }
}

async function fetchProviderEvents(providerName: string, userId?: string) {
  if (providerName === "tesla") {
    const teslaProvider = new TeslaVehicleProvider(userId);
    return teslaProvider.fetchVehicleEvents();
  }
  return [];
}

async function resetMockFleet() {
  await prisma.vehicle.deleteMany({
    where: {
      teslaAccountId: null,
      ...activeVehicleWhere,
    },
  });
}

async function softUnlinkMissingTeslaVehicles(
  teslaAccountId: string,
  activeVins: Set<string>,
) {
  const linkedVehicles = await prisma.vehicle.findMany({
    where: {
      teslaAccountId,
      ...activeVehicleWhere,
      oemVehicleId: { not: null },
    },
  });

  const now = new Date();

  for (const vehicle of linkedVehicles) {
    if (vehicle.oemVehicleId && !activeVins.has(vehicle.oemVehicleId)) {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          unlinkedAt: now,
          isDeleted: true,
        },
      });
    }
  }
}

export async function syncVehiclesFromProvider(userId?: string): Promise<SyncVehiclesResult> {
  const requestedProvider = getVehicleProviderName();
  const lastSyncedAt = new Date();

  let resolvedUserId = userId;
  let teslaAccountId: string | null = null;

  if (requestedProvider === "tesla") {
    const account = userId
      ? await getActiveTeslaAccountForUser(userId)
      : await getAnyActiveTeslaAccount();
    if (!account) {
      await resetMockFleet();
      await prisma.vehicleEvent.deleteMany({
        where: {
          vehicle: activeVehicleWhere,
        },
      });
      await prisma.syncMetadata.upsert({
        where: { id: "default" },
        update: {
          lastSyncedAt,
          provider: "tesla",
          usedFallback: false,
          lastError: null,
        },
        create: {
          id: "default",
          lastSyncedAt,
          provider: "tesla",
          usedFallback: false,
          lastError: null,
        },
      });

      return {
        provider: "tesla",
        usedFallback: false,
        vehicleCount: 0,
        eventCount: 0,
        lastSyncedAt: lastSyncedAt.toISOString(),
      };
    }

    resolvedUserId = account.userId;
    teslaAccountId = account.id;
  }

  const provider =
    requestedProvider === "tesla"
      ? new TeslaVehicleProvider(resolvedUserId)
      : createVehicleProvider();
  const usedFallback = false;
  let errorMessage: string | undefined;

  let snapshots: VehicleSnapshotData[] = [];

  try {
    snapshots = await provider.fetchVehicles();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown sync error";
    throw error;
  }

  const effectiveProvider = provider.name;

  if (effectiveProvider === "mock") {
    await resetMockFleet();
  }

  for (const snapshot of snapshots) {
    await upsertSnapshot(snapshot, {
      teslaAccountId: effectiveProvider === "tesla" ? teslaAccountId : null,
    });
  }

  if (effectiveProvider === "tesla" && teslaAccountId) {
    const activeVins = new Set(
      snapshots
        .map((snapshot) => snapshot.oemVehicleId)
        .filter((vin): vin is string => Boolean(vin)),
    );
    await softUnlinkMissingTeslaVehicles(teslaAccountId, activeVins);
  }

  let events: VehicleEventData[] = [];
  try {
    events = await fetchProviderEvents(effectiveProvider, resolvedUserId);
  } catch (error) {
    console.warn("Failed to fetch provider events:", error);
    events = [];
  }

  await replaceEvents(events);

  await prisma.syncMetadata.upsert({
    where: { id: "default" },
    update: {
      lastSyncedAt,
      provider: effectiveProvider,
      usedFallback,
      lastError: errorMessage ?? null,
    },
    create: {
      id: "default",
      lastSyncedAt,
      provider: effectiveProvider,
      usedFallback,
      lastError: errorMessage ?? null,
    },
  });

  const activeCount = await prisma.vehicle.count({
    where: activeVehicleWhere,
  });

  return {
    provider: effectiveProvider,
    usedFallback,
    vehicleCount: activeCount,
    eventCount: events.length,
    lastSyncedAt: lastSyncedAt.toISOString(),
    error: errorMessage,
  };
}

export async function getSyncMetadata() {
  return prisma.syncMetadata.findUnique({
    where: { id: "default" },
  });
}

export async function shouldAutoSync() {
  const metadata = await getSyncMetadata();
  if (!metadata?.lastSyncedAt) {
    return true;
  }

  const { getSyncPollIntervalMs } = await import("@/lib/tesla/config");
  return Date.now() - metadata.lastSyncedAt.getTime() >= getSyncPollIntervalMs();
}
