import { AuditLogStatus, RestSyncReason, VehicleLifecycle } from "@prisma/client";

import { createAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { buildDisplayModel } from "@/lib/tesla/display-model";
import {
  ensureVehicleSyncState,
  isRestWakeCooldownElapsed,
  patchVehicleSyncState,
} from "@/lib/tesla/hybrid/sync-state";
import { mapTeslaVehicleToSnapshot, TeslaFleetClient } from "@/lib/tesla/mapper";
import {
  getRestWakeCooldownMinutes,
  isBaselineOnReadyEnabled,
} from "@/lib/tesla/telemetry/config";
import { activeVehicleWhere } from "@/lib/vehicle-query";
import type { VehicleSnapshotData } from "@/lib/vehicle-providers/types";

export type WriteRestSnapshotOptions = {
  teslaAccountId?: string | null;
  telemetrySource?: "REST" | "MIXED" | "TELEMETRY";
  lastRestSyncAt?: Date;
  preserveTelemetryFields?: boolean;
  existingLastTelemetryAt?: Date | null;
  /** BASELINE / MANUAL_FALLBACK / SPECS_REFRESH 만 제원 컬럼 갱신 */
  updateSpecs?: boolean;
  restSyncReason?: RestSyncReason;
};

function specsUpdateData(snapshot: VehicleSnapshotData, now: Date) {
  const displayModel =
    buildDisplayModel(snapshot.carType, snapshot.trimBadging) ?? snapshot.model;

  return {
    carType: snapshot.carType ?? null,
    trimBadging: snapshot.trimBadging ?? null,
    exteriorColor: snapshot.exteriorColor ?? null,
    teslaDisplayName: snapshot.teslaDisplayName ?? null,
    model: displayModel,
    specsSyncedAt: now,
  };
}

/** REST vehicle_data 결과를 Vehicle(+제원 선택) + Snapshot + SyncState에 반영 */
export async function writeRestSnapshot(
  snapshot: VehicleSnapshotData,
  options: WriteRestSnapshotOptions = {},
) {
  const {
    teslaAccountId = null,
    telemetrySource = "REST",
    lastRestSyncAt = new Date(),
    preserveTelemetryFields = false,
    existingLastTelemetryAt = null,
    updateSpecs = false,
    restSyncReason,
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
  const now = lastRestSyncAt;

  const registryFields = {
    plateNumber: snapshot.plateNumber,
    year: snapshot.year,
    oemVehicleId: snapshot.oemVehicleId,
    teslaAccountId,
    unlinkedAt: null as Date | null,
    isDeleted: false,
    ...(snapshot.teslaDisplayName
      ? { teslaDisplayName: snapshot.teslaDisplayName }
      : {}),
  };

  const vehicle = existing
    ? await prisma.vehicle.update({
        where: { id: existing.id },
        data: {
          ...registryFields,
          ...(updateSpecs
            ? specsUpdateData(snapshot, now)
            : existing.specsSyncedAt
              ? {}
              : { model: snapshot.model }),
        },
      })
    : await prisma.vehicle.upsert({
        where: { plateNumber: snapshot.plateNumber },
        update: {
          ...registryFields,
          ...(updateSpecs
            ? specsUpdateData(snapshot, now)
            : { model: snapshot.model }),
        },
        create: {
          plateNumber: snapshot.plateNumber,
          model: updateSpecs
            ? (buildDisplayModel(snapshot.carType, snapshot.trimBadging) ??
              snapshot.model)
            : snapshot.model,
          year: snapshot.year,
          oemVehicleId: snapshot.oemVehicleId,
          teslaAccountId,
          ...(updateSpecs ? specsUpdateData(snapshot, now) : {}),
          ...(snapshot.teslaDisplayName
            ? { teslaDisplayName: snapshot.teslaDisplayName }
            : {}),
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

  if (restSyncReason) {
    const syncPatch: Parameters<typeof patchVehicleSyncState>[1] = {
      lastRestSyncAt,
      lastRestSyncReason: restSyncReason,
    };

    if (restSyncReason === RestSyncReason.BASELINE) {
      syncPatch.baselineCompletedAt = now;
      syncPatch.baselineLastError = null;
      syncPatch.lifecycle = VehicleLifecycle.READY;
    }

    await patchVehicleSyncState(vehicle.id, syncPatch);
  }

  return vehicle;
}

async function resolveTeslaUserId(vehicleId: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, ...activeVehicleWhere },
    include: { teslaAccount: { select: { id: true, userId: true } } },
  });
  if (!vehicle?.teslaAccount || !vehicle.oemVehicleId) {
    return null;
  }
  return {
    userId: vehicle.teslaAccount.userId,
    teslaAccountId: vehicle.teslaAccount.id,
    vin: vehicle.oemVehicleId,
    vehicleId: vehicle.id,
  };
}

export type RestSyncOnceResult =
  | { ok: true; reason: RestSyncReason; vehicleId: string }
  | { ok: false; skipped?: boolean; error: string; vehicleId?: string };

/** Baseline: vehicle_data 1회. 실패 시 wake 금지, 에러만 SyncState에 기록 */
export async function runBaselineForVehicle(
  vehicleId: string,
): Promise<RestSyncOnceResult> {
  const ctx = await resolveTeslaUserId(vehicleId);
  if (!ctx) {
    return { ok: false, error: "vehicle_or_tesla_account_missing", vehicleId };
  }

  const client = new TeslaFleetClient(ctx.userId);
  try {
    const [list, fleet] = await Promise.all([
      client.listVehicles(),
      client.getFleetStatus([ctx.vin]),
    ]);
    const listItem = list.find(
      (item) => item.vin.toUpperCase() === ctx.vin.toUpperCase(),
    );
    if (!listItem) {
      const error = "vin_not_in_account";
      await patchVehicleSyncState(vehicleId, { baselineLastError: error });
      return { ok: false, error, vehicleId };
    }

    const data = await client.getVehicleData(ctx.vin);
    const snapshot = mapTeslaVehicleToSnapshot(
      listItem,
      data,
      fleet.items.find((item) => item.vin.toUpperCase() === ctx.vin.toUpperCase()),
    );

    await writeRestSnapshot(snapshot, {
      teslaAccountId: ctx.teslaAccountId,
      updateSpecs: true,
      restSyncReason: RestSyncReason.BASELINE,
      lastRestSyncAt: new Date(),
    });

    await createAuditLog({
      action: "VEHICLE_BASELINE_SYNC",
      targetType: "Vehicle",
      targetId: vehicleId,
      vehicleId,
      teslaAccountId: ctx.teslaAccountId,
      status: AuditLogStatus.SUCCESS,
      summary: `Baseline vehicle_data 성공 (${ctx.vin})`,
      metadata: { reason: RestSyncReason.BASELINE, vin: ctx.vin },
    });

    return { ok: true, reason: RestSyncReason.BASELINE, vehicleId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "baseline_failed";
    await patchVehicleSyncState(vehicleId, { baselineLastError: message });
    await createAuditLog({
      action: "VEHICLE_BASELINE_SYNC",
      targetType: "Vehicle",
      targetId: vehicleId,
      vehicleId,
      teslaAccountId: ctx.teslaAccountId,
      status: AuditLogStatus.FAILURE,
      summary: `Baseline vehicle_data 실패 (wake 미시도): ${message}`,
      metadata: { reason: RestSyncReason.BASELINE, vin: ctx.vin, noWake: true },
    });
    return { ok: false, error: message, vehicleId };
  }
}

/** ASLEEP→ONLINE 후 쿨다운 경과 시에만 vehicle_data 1회 (제원 미갱신) */
export async function maybeRunWakeCooldownRestSync(
  vehicleId: string,
): Promise<RestSyncOnceResult> {
  const syncState = await prisma.vehicleSyncState.findUnique({
    where: { vehicleId },
  });
  const cooldownMinutes = getRestWakeCooldownMinutes();

  if (!isRestWakeCooldownElapsed(syncState?.lastRestSyncAt, cooldownMinutes)) {
    return {
      ok: false,
      skipped: true,
      error: "wake_cooldown_active",
      vehicleId,
    };
  }

  const ctx = await resolveTeslaUserId(vehicleId);
  if (!ctx) {
    return { ok: false, error: "vehicle_or_tesla_account_missing", vehicleId };
  }

  const client = new TeslaFleetClient(ctx.userId);
  try {
    const list = await client.listVehicles();
    const listItem = list.find(
      (item) => item.vin.toUpperCase() === ctx.vin.toUpperCase(),
    );
    if (!listItem) {
      return { ok: false, error: "vin_not_in_account", vehicleId };
    }

    const data = await client.getVehicleData(ctx.vin);
    const snapshot = mapTeslaVehicleToSnapshot(listItem, data);

    await writeRestSnapshot(snapshot, {
      teslaAccountId: ctx.teslaAccountId,
      updateSpecs: false,
      restSyncReason: RestSyncReason.WAKE_COOLDOWN,
      lastRestSyncAt: new Date(),
    });

    await createAuditLog({
      action: "VEHICLE_WAKE_REST_SYNC",
      targetType: "Vehicle",
      targetId: vehicleId,
      vehicleId,
      teslaAccountId: ctx.teslaAccountId,
      status: AuditLogStatus.SUCCESS,
      summary: `Wake 쿨다운 후 vehicle_data 1회 (${ctx.vin})`,
      metadata: {
        reason: RestSyncReason.WAKE_COOLDOWN,
        vin: ctx.vin,
        cooldownMinutes,
      },
    });

    return { ok: true, reason: RestSyncReason.WAKE_COOLDOWN, vehicleId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "wake_rest_sync_failed";
    await createAuditLog({
      action: "VEHICLE_WAKE_REST_SYNC",
      targetType: "Vehicle",
      targetId: vehicleId,
      vehicleId,
      teslaAccountId: ctx.teslaAccountId,
      status: AuditLogStatus.FAILURE,
      summary: `Wake REST sync 실패 (재시도 루프 없음): ${message}`,
      metadata: {
        reason: RestSyncReason.WAKE_COOLDOWN,
        vin: ctx.vin,
        noWake: true,
      },
    });
    return { ok: false, error: message, vehicleId };
  }
}

/** VK 확인: fleet_status → TELEMETRY_PENDING, 선택적 Baseline */
export async function confirmVirtualKeyForVehicle(vehicleId: string) {
  const ctx = await resolveTeslaUserId(vehicleId);
  if (!ctx) {
    return { ok: false as const, error: "vehicle_or_tesla_account_missing" };
  }

  const client = new TeslaFleetClient(ctx.userId);
  const fleet = await client.getFleetStatus([ctx.vin]);
  const paired = fleet.keyPairedVins.some(
    (vin) => vin.toUpperCase() === ctx.vin.toUpperCase(),
  );
  const unpaired = fleet.unpairedVins.some(
    (vin) => vin.toUpperCase() === ctx.vin.toUpperCase(),
  );

  if (unpaired || !paired) {
    await patchVehicleSyncState(vehicleId, {
      lifecycle: VehicleLifecycle.KEY_PENDING,
    });
    return {
      ok: false as const,
      error: "virtual_key_not_paired",
      keyPairedVins: fleet.keyPairedVins,
      unpairedVins: fleet.unpairedVins,
    };
  }

  const now = new Date();
  await patchVehicleSyncState(vehicleId, {
    lifecycle: VehicleLifecycle.TELEMETRY_PENDING,
    virtualKeyConfirmedAt: now,
  });

  await prisma.telemetrySubscription.upsert({
    where: { vehicleId },
    update: {
      vin: ctx.vin,
      teslaAccountId: ctx.teslaAccountId,
      active: true,
      unsubscribedAt: null,
      lastError: null,
    },
    create: {
      vehicleId,
      vin: ctx.vin,
      teslaAccountId: ctx.teslaAccountId,
      active: true,
    },
  });

  let baseline: RestSyncOnceResult | null = null;
  if (isBaselineOnReadyEnabled()) {
    baseline = await runBaselineForVehicle(vehicleId);
  }

  return {
    ok: true as const,
    lifecycle: VehicleLifecycle.TELEMETRY_PENDING,
    baseline,
  };
}

/** 계정 내 Baseline 미완료 차량에 best-effort 1회씩 (wake 없음) */
export async function tryBaselinesForAccount(teslaAccountId: string) {
  if (!isBaselineOnReadyEnabled()) {
    return { attempted: 0, succeeded: 0 };
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      teslaAccountId,
      ...activeVehicleWhere,
      syncState: {
        OR: [
          { baselineCompletedAt: null },
          {
            lifecycle: {
              in: [
                VehicleLifecycle.TELEMETRY_PENDING,
                VehicleLifecycle.KEY_PENDING,
                VehicleLifecycle.REGISTERED,
              ],
            },
          },
        ],
      },
    },
    select: { id: true },
    take: 20,
  });

  let succeeded = 0;
  for (const vehicle of vehicles) {
    const result = await runBaselineForVehicle(vehicle.id);
    if (result.ok) succeeded += 1;
  }

  return { attempted: vehicles.length, succeeded };
}
