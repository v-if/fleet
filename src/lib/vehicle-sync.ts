import {
  getActiveTeslaAccountForUser,
  getAnyActiveTeslaAccount,
} from "@/lib/tesla/auth";
import {
  isTelemetryEnabled,
  resolveVehicleSyncMode,
  type VehicleSyncMode,
} from "@/lib/tesla/telemetry/config";
import { isTelemetryFresh } from "@/lib/tesla/telemetry/processor";
import { ensureTelemetrySubscriptionsForAccount } from "@/lib/tesla/telemetry/subscription";
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
  syncMode?: VehicleSyncMode;
  skippedVehicleDataCount?: number;
  snapshotsWritten?: number;
  error?: string;
};

export type SyncVehiclesOptions = {
  forceFallback?: boolean;
  mode?: VehicleSyncMode | "auto";
};

type UpsertSnapshotOptions = {
  teslaAccountId?: string | null;
  telemetrySource?: "REST" | "MIXED" | "TELEMETRY";
  lastRestSyncAt?: Date;
  preserveTelemetryFields?: boolean;
  existingLastTelemetryAt?: Date | null;
};

/** Phase 4.4.A: Vehicle 생성 직후 SyncState 보장 (없으면 REGISTERED) */
async function ensureVehicleSyncState(vehicleId: string) {
  await prisma.vehicleSyncState.upsert({
    where: { vehicleId },
    create: { vehicleId },
    update: {},
  });
}

async function getLatestTelemetryAt(
  teslaAccountId: string | null,
  oemVehicleId: string | undefined,
) {
  if (!teslaAccountId || !oemVehicleId) return null;

  const vehicle = await prisma.vehicle.findFirst({
    where: { teslaAccountId, oemVehicleId },
    include: {
      snapshots: {
        orderBy: { lastUpdatedAt: "desc" },
        take: 1,
        select: { lastTelemetryAt: true },
      },
    },
  });

  return vehicle?.snapshots[0]?.lastTelemetryAt ?? null;
}

async function upsertVehicleRegistry(
  snapshot: VehicleSnapshotData,
  teslaAccountId: string | null,
) {
  const existing =
    teslaAccountId && snapshot.oemVehicleId
      ? await prisma.vehicle.findFirst({
          where: {
            teslaAccountId,
            oemVehicleId: snapshot.oemVehicleId,
          },
        })
      : null;

  if (existing) {
    return prisma.vehicle.update({
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
    });
  }

  const created = await prisma.vehicle.upsert({
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
  await ensureVehicleSyncState(created.id);
  return created;
}

async function upsertSnapshot(
  snapshot: VehicleSnapshotData,
  options: UpsertSnapshotOptions = {},
) {
  const {
    teslaAccountId = null,
    telemetrySource = "REST",
    lastRestSyncAt = new Date(),
    preserveTelemetryFields = false,
    existingLastTelemetryAt = null,
  } = options;

  const existing =
    teslaAccountId && snapshot.oemVehicleId
      ? await prisma.vehicle.findFirst({
          where: {
            teslaAccountId,
            oemVehicleId: snapshot.oemVehicleId,
          },
          include: {
            snapshots: {
              orderBy: { lastUpdatedAt: "desc" },
              take: 1,
            },
          },
        })
      : null;

  const previousSnapshot = existing?.snapshots[0];

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

  await ensureVehicleSyncState(vehicle.id);

  const resolvedTelemetrySource =
    preserveTelemetryFields && previousSnapshot?.telemetrySource === "TELEMETRY"
      ? "MIXED"
      : telemetrySource;

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
      lastTelemetryAt: preserveTelemetryFields
        ? (existingLastTelemetryAt ?? previousSnapshot?.lastTelemetryAt ?? null)
        : null,
      lastRestSyncAt,
      telemetrySource: resolvedTelemetrySource,
      isAsleepInferred: preserveTelemetryFields
        ? (previousSnapshot?.isAsleepInferred ?? false)
        : false,
      sleepInferredAt: preserveTelemetryFields
        ? (previousSnapshot?.sleepInferredAt ?? null)
        : null,
      lastUpdatedAt: snapshot.lastUpdatedAt,
    },
  });

  return vehicle;
}

async function replaceEvents(
  events: VehicleEventData[],
  options: { teslaAccountId?: string | null } = {},
) {
  const { teslaAccountId } = options;
  await prisma.vehicleEvent.deleteMany({
    where: teslaAccountId
      ? {
          vehicle: {
            ...activeVehicleWhere,
            teslaAccountId,
          },
        }
      : {
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

export async function syncVehiclesFromProvider(
  userId?: string,
  options: SyncVehiclesOptions = {},
): Promise<SyncVehiclesResult> {
  const requestedProvider = getVehicleProviderName();
  const lastSyncedAt = new Date();
  const syncMode = resolveVehicleSyncMode(options);
  const registryOnly = syncMode === "registry";

  let resolvedUserId = userId;
  let teslaAccountId: string | null = null;

  if (requestedProvider === "tesla") {
    const account = userId
      ? await getActiveTeslaAccountForUser(userId)
      : await getAnyActiveTeslaAccount();
    if (!account) {
      await resetMockFleet();
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

      const activeCount = await prisma.vehicle.count({
        where: activeVehicleWhere,
      });

      return {
        provider: "tesla",
        usedFallback: false,
        vehicleCount: activeCount,
        eventCount: 0,
        lastSyncedAt: lastSyncedAt.toISOString(),
        syncMode,
        snapshotsWritten: 0,
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
  let skippedVehicleDataCount = 0;

  try {
    const telemetryEnabled = isTelemetryEnabled();
    const skipVehicleData = telemetryEnabled
      ? async (vin: string) => {
          const lastTelemetryAt = await getLatestTelemetryAt(teslaAccountId, vin);
          return isTelemetryFresh(lastTelemetryAt);
        }
      : undefined;

    if (provider instanceof TeslaVehicleProvider) {
      const result = await provider.fetchVehiclesWithMeta({
        registryOnly,
        skipVehicleData: registryOnly ? undefined : skipVehicleData,
      });
      snapshots = result.snapshots;
      skippedVehicleDataCount = result.skippedVehicleDataCount;
    } else {
      snapshots = await provider.fetchVehicles();
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown sync error";
    throw error;
  }

  const effectiveProvider = provider.name;

  if (effectiveProvider === "mock") {
    await resetMockFleet();
  }

  let snapshotsWritten = 0;

  for (const snapshot of snapshots) {
    if (registryOnly && effectiveProvider === "tesla") {
      await upsertVehicleRegistry(snapshot, teslaAccountId);
      continue;
    }

    const lastTelemetryAt = await getLatestTelemetryAt(
      effectiveProvider === "tesla" ? teslaAccountId : null,
      snapshot.oemVehicleId,
    );
    const preserveTelemetryFields = Boolean(
      isTelemetryEnabled() && isTelemetryFresh(lastTelemetryAt),
    );

    await upsertSnapshot(snapshot, {
      teslaAccountId: effectiveProvider === "tesla" ? teslaAccountId : null,
      telemetrySource: "REST",
      lastRestSyncAt: lastSyncedAt,
      preserveTelemetryFields,
      existingLastTelemetryAt: lastTelemetryAt,
    });
    snapshotsWritten += 1;
  }

  if (registryOnly && effectiveProvider === "tesla" && teslaAccountId) {
    await ensureTelemetrySubscriptionsForAccount(teslaAccountId);
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
  if (!registryOnly) {
    try {
      events = await fetchProviderEvents(effectiveProvider, resolvedUserId);
    } catch (error) {
      console.warn("Failed to fetch provider events:", error);
      events = [];
    }

    await replaceEvents(events, {
      teslaAccountId: effectiveProvider === "tesla" ? teslaAccountId : null,
    });
  }

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
    syncMode,
    skippedVehicleDataCount,
    snapshotsWritten,
    error: errorMessage,
  };
}

export async function getSyncMetadata() {
  return prisma.syncMetadata.findUnique({
    where: { id: "default" },
  });
}

export async function shouldAutoSync() {
  const { isRestAutoSyncEnabled } = await import("@/lib/tesla/telemetry/config");
  if (!isRestAutoSyncEnabled()) {
    return false;
  }

  const metadata = await getSyncMetadata();
  if (!metadata?.lastSyncedAt) {
    return true;
  }

  const { getSyncPollIntervalMs } = await import("@/lib/tesla/config");
  return Date.now() - metadata.lastSyncedAt.getTime() >= getSyncPollIntervalMs();
}
