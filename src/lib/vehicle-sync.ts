import { RestSyncReason } from "@prisma/client";

import {
  getActiveTeslaAccountForUser,
  getAnyActiveTeslaAccount,
} from "@/lib/tesla/auth";
import {
  applyRegistryLifecycleHint,
  ensureVehicleSyncState,
} from "@/lib/tesla/hybrid/sync-state";
import {
  tryBaselinesForAccount,
  writeRestSnapshot,
} from "@/lib/tesla/hybrid/rest-sync";
import {
  isBaselineOnReadyEnabled,
  isRestFreezeEnabled,
  isTelemetryEnabled,
  resolveVehicleSyncMode,
  type VehicleSyncMode,
} from "@/lib/tesla/telemetry/config";
import { isTelemetryFresh } from "@/lib/tesla/telemetry/processor";
import { ensureTelemetrySubscriptionsForAccount } from "@/lib/tesla/telemetry/subscription";
import { prisma } from "@/lib/prisma";
import { activeVehicleWhere } from "@/lib/vehicle-query";
import {
  shouldPreservePlateNumber,
  withoutPlateNumberIfPreserved,
} from "@/lib/vehicle-display-name";
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
  baselineAttempted?: number;
  baselineSucceeded?: number;
  /** TRF: REST Freeze 활성 */
  restFreeze?: boolean;
  /** TRF: fallback=1 요청이 Freeze로 거절됨 */
  frozenFallbackBlocked?: boolean;
  error?: string;
};

export type SyncVehiclesOptions = {
  forceFallback?: boolean;
  mode?: VehicleSyncMode | "auto";
};

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

/** registry-only: Snapshot 미생성, 제원 덮어쓰기 금지, SyncState lifecycle 힌트 */
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

  const registryData = {
    plateNumber: snapshot.plateNumber,
    year: snapshot.year,
    oemVehicleId: snapshot.oemVehicleId,
    teslaAccountId,
    unlinkedAt: null as Date | null,
    isDeleted: false,
    ...(snapshot.teslaDisplayName
      ? { teslaDisplayName: snapshot.teslaDisplayName }
      : {}),
    ...(snapshot.teslaVehicleId !== undefined
      ? { teslaVehicleId: snapshot.teslaVehicleId ?? null }
      : {}),
    ...(snapshot.accessType !== undefined
      ? { accessType: snapshot.accessType ?? null }
      : {}),
  };

  if (existing) {
    const preservePlateNumber = shouldPreservePlateNumber(existing.plateNumberEditedAt);
    const registryUpdate = withoutPlateNumberIfPreserved(registryData, preservePlateNumber);
    const updated = await prisma.vehicle.update({
      where: { id: existing.id },
      data: {
        ...registryUpdate,
        // 제원 동기화 전이면 placeholder model만 유지/갱신
        ...(existing.specsSyncedAt ? {} : { model: snapshot.model }),
      },
    });
    await ensureVehicleSyncState(updated.id);
    return updated;
  }

  const created = await prisma.vehicle.upsert({
    where: { plateNumber: snapshot.plateNumber },
    update: {
      ...registryData,
      model: snapshot.model,
    },
    create: {
      plateNumber: snapshot.plateNumber,
      model: snapshot.model,
      year: snapshot.year,
      oemVehicleId: snapshot.oemVehicleId,
      teslaAccountId,
      ...(snapshot.teslaDisplayName
        ? { teslaDisplayName: snapshot.teslaDisplayName }
        : {}),
    },
  });
  await ensureVehicleSyncState(created.id);
  return created;
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
      await prisma.$transaction([
        prisma.vehicleSyncState.deleteMany({ where: { vehicleId: vehicle.id } }),
        prisma.telemetrySubscription.updateMany({
          where: { vehicleId: vehicle.id },
          data: {
            active: false,
            configSynced: false,
            configCheckedAt: null,
            unsubscribedAt: now,
          },
        }),
        prisma.vehicle.update({
          where: { id: vehicle.id },
          data: {
            unlinkedAt: now,
            isDeleted: true,
          },
        }),
      ]);
    }
  }
}

export async function syncVehiclesFromProvider(
  userId?: string,
  options: SyncVehiclesOptions = {},
): Promise<SyncVehiclesResult> {
  const requestedProvider = getVehicleProviderName();
  const lastSyncedAt = new Date();
  const restFreeze = isRestFreezeEnabled();
  const syncMode = resolveVehicleSyncMode(options);
  const registryOnly = syncMode === "registry";
  const usedFallback = Boolean(options.forceFallback) && !restFreeze;
  const frozenFallbackBlocked = Boolean(options.forceFallback) && restFreeze;

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

  let errorMessage: string | undefined;
  let snapshots: VehicleSnapshotData[] = [];
  let skippedVehicleDataCount = 0;
  let keyPairedVins: string[] = [];
  let unpairedVins: string[] = [];

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
      keyPairedVins = result.keyPairedVins;
      unpairedVins = result.unpairedVins;
    } else {
      snapshots = await provider.fetchVehicles();
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown sync error";
    throw error;
  }

  const effectiveProvider = provider.name;
  const keyPairedSet = new Set(keyPairedVins);
  const unpairedSet = new Set(unpairedVins);

  if (effectiveProvider === "mock") {
    await resetMockFleet();
  }

  let snapshotsWritten = 0;

  for (const snapshot of snapshots) {
    // TRF: Freeze — registry 메타만, Snapshot REST 금지
    if (isRestFreezeEnabled()) {
      if (effectiveProvider === "tesla") {
        const vehicle = await upsertVehicleRegistry(snapshot, teslaAccountId);
        await applyRegistryLifecycleHint(
          vehicle.id,
          snapshot.oemVehicleId,
          keyPairedSet,
          unpairedSet,
        );
      }
      continue;
    }

    if (registryOnly && effectiveProvider === "tesla") {
      const vehicle = await upsertVehicleRegistry(snapshot, teslaAccountId);
      await applyRegistryLifecycleHint(
        vehicle.id,
        snapshot.oemVehicleId,
        keyPairedSet,
        unpairedSet,
      );
      continue;
    }

    const lastTelemetryAt = await getLatestTelemetryAt(
      effectiveProvider === "tesla" ? teslaAccountId : null,
      snapshot.oemVehicleId,
    );
    const preserveTelemetryFields = Boolean(
      isTelemetryEnabled() && isTelemetryFresh(lastTelemetryAt),
    );

    // 수동 fallback만 제원 갱신 허용. 일반 full(레거시)은 동적 Snapshot만.
    const updateSpecs = usedFallback && Boolean(snapshot.carType);

    await writeRestSnapshot(snapshot, {
      teslaAccountId: effectiveProvider === "tesla" ? teslaAccountId : null,
      telemetrySource: "REST",
      lastRestSyncAt: lastSyncedAt,
      preserveTelemetryFields,
      existingLastTelemetryAt: lastTelemetryAt,
      updateSpecs,
      restSyncReason: usedFallback ? RestSyncReason.MANUAL_FALLBACK : undefined,
    });
    snapshotsWritten += 1;
  }

  if (registryOnly && effectiveProvider === "tesla" && teslaAccountId) {
    await ensureTelemetrySubscriptionsForAccount(teslaAccountId);
  }

  let baselineAttempted = 0;
  let baselineSucceeded = 0;
  if (
    !isRestFreezeEnabled() &&
    registryOnly &&
    effectiveProvider === "tesla" &&
    teslaAccountId &&
    isBaselineOnReadyEnabled()
  ) {
    const baseline = await tryBaselinesForAccount(teslaAccountId);
    baselineAttempted = baseline.attempted;
    baselineSucceeded = baseline.succeeded;
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
    baselineAttempted,
    baselineSucceeded,
    restFreeze,
    frozenFallbackBlocked,
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
