import {
  AuditLogStatus,
  ChargingStationSiteType,
  RestSyncReason,
  TelemetrySource,
  VehicleLifecycle,
  type VehicleSnapshot,
} from "@prisma/client";

import { createAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { buildDisplayModel } from "@/lib/tesla/display-model";
import {
  shouldPreservePlateNumber,
  withoutPlateNumberIfPreserved,
} from "@/lib/vehicle-display-name";
import { mergeSnapshotCoordinates } from "@/lib/tesla/hybrid/coordinates";
import {
  ensureVehicleSyncState,
  isRestWakeCooldownElapsed,
  patchVehicleSyncState,
} from "@/lib/tesla/hybrid/sync-state";
import { applyActivitySessionFromObservation } from "@/lib/vehicle-activity-session";
import { TeslaFleetClient } from "@/lib/tesla/mapper";
import {
  extractVehicleSpecs,
  specsAuditFields,
  writeVehicleSpecs,
} from "@/lib/tesla/hybrid/vehicle-specs";
import {
  isNearbyCatalogFallbackEnabled,
  queryNearbyFromCatalog,
  upsertChargingStationsFromSeeds,
} from "@/lib/tesla/charging-station-catalog";
import { serializeNearbyChargingSites } from "@/lib/tesla/nearby-charging";
import type { ParkNearbyTrigger } from "@/lib/tesla/park-nearby-trigger";
import { mergeCafSnapshotFields, pickCafSnapshotFields } from "@/lib/tesla/telemetry/caf-fields";
import { normalizeShiftState } from "@/lib/tesla/shift-state";
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
    ...(snapshot.firmwareVersion !== undefined
      ? { firmwareVersion: snapshot.firmwareVersion ?? null }
      : {}),
    ...(snapshot.roofColor !== undefined
      ? { roofColor: snapshot.roofColor ?? null }
      : {}),
    ...(snapshot.wheelType !== undefined
      ? { wheelType: snapshot.wheelType ?? null }
      : {}),
    ...(snapshot.chargePortType !== undefined
      ? { chargePortType: snapshot.chargePortType ?? null }
      : {}),
    ...(snapshot.driverAssist !== undefined
      ? { driverAssist: snapshot.driverAssist ?? null }
      : {}),
    ...(snapshot.exteriorTrim !== undefined
      ? { exteriorTrim: snapshot.exteriorTrim ?? null }
      : {}),
    ...(snapshot.teslaVehicleId !== undefined
      ? { teslaVehicleId: snapshot.teslaVehicleId ?? null }
      : {}),
    ...(snapshot.accessType !== undefined
      ? { accessType: snapshot.accessType ?? null }
      : {}),
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

  let previousSnapshot = existing?.snapshots[0];
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
          ...withoutPlateNumberIfPreserved(
            registryFields,
            shouldPreservePlateNumber(existing.plateNumberEditedAt),
          ),
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

  // plate upsert 등 existing 조회를 못 한 경우에도 직전 Snapshot으로 좌표 merge (LN-R)
  if (!previousSnapshot) {
    previousSnapshot =
      (await prisma.vehicleSnapshot.findFirst({
        where: { vehicleId: vehicle.id },
        orderBy: { lastUpdatedAt: "desc" },
      })) ?? undefined;
  }

  const { latitude, longitude } = mergeSnapshotCoordinates(
    snapshot,
    previousSnapshot,
  );
  const suppressTripCoalesce =
    normalizeShiftState(snapshot.shiftState ?? previousSnapshot?.shiftState) === "P";
  const cafFields = mergeCafSnapshotFields({}, previousSnapshot, {
    suppressTripCoalesce,
  });

  const resolvedTelemetrySource =
    preserveTelemetryFields && previousSnapshot?.telemetrySource === "TELEMETRY"
      ? "MIXED"
      : telemetrySource;

  await prisma.vehicleSnapshot.create({
    data: {
      vehicleId: vehicle.id,
      latitude,
      longitude,
      batteryPercent: snapshot.batteryPercent,
      rangeKm: snapshot.rangeKm,
      ignitionOn: snapshot.ignitionOn,
      status: snapshot.status,
      chargingStatus: snapshot.chargingStatus,
      odometerKm: snapshot.odometerKm,
      chargeLimitSoc: snapshot.chargeLimitSoc ?? null,
      chargerPowerKw: snapshot.chargerPowerKw ?? null,
      /** REST는 AC/DC 미상 — Telemetry 유지 시 이전 kind 보존 */
      chargingPowerKind: preserveTelemetryFields
        ? (previousSnapshot?.chargingPowerKind ?? null)
        : (snapshot.chargingPowerKind ?? null),
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
      ...cafFields,
      nearbyChargingSites: snapshot.nearbyChargingSites
        ? serializeNearbyChargingSites(snapshot.nearbyChargingSites, {
            capturedAt: lastRestSyncAt,
            capturedLat: latitude,
            capturedLng: longitude,
          })
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

  // VD3-H: REST Snapshot 전이 → ActivitySession FSM
  try {
    await applyActivitySessionFromObservation(
      vehicle.id,
      {
        at: snapshot.lastUpdatedAt ?? lastRestSyncAt,
        shiftState: snapshot.shiftState ?? null,
        chargingStatus: snapshot.chargingStatus ?? null,
        status: snapshot.status ?? null,
        odometerKm: snapshot.odometerKm ?? null,
        batteryPercent: snapshot.batteryPercent ?? null,
        chargingPowerKind: preserveTelemetryFields
          ? (previousSnapshot?.chargingPowerKind ?? snapshot.chargingPowerKind ?? null)
          : (snapshot.chargingPowerKind ?? null),
        chargerPowerKw: snapshot.chargerPowerKw ?? null,
        vehicleSpeedKmh: null,
        rangeKm: snapshot.rangeKm ?? null,
        chargeLimitSoc: snapshot.chargeLimitSoc ?? null,
      },
      "DERIVED",
    );
  } catch (error) {
    console.warn(`Activity session FSM failed for ${vehicle.id}:`, error);
  }

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

/** Baseline: 제원 전용 vehicle_data 1회 (TRF-B1). Snapshot/nearby/alerts 없음. wake 금지.
 * Freeze 졸업 경로 — `TESLA_REST_FREEZE`와 무관하게 항상 실행. */
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
    const fleetItem = fleet.items.find(
      (item) => item.vin.toUpperCase() === ctx.vin.toUpperCase(),
    );
    const specs = extractVehicleSpecs(listItem, data, fleetItem);
    const now = new Date();

    await writeVehicleSpecs(vehicleId, specs, {
      teslaAccountId: ctx.teslaAccountId,
      restSyncReason: RestSyncReason.BASELINE,
      lastRestSyncAt: now,
    });

    await createAuditLog({
      action: "VEHICLE_BASELINE_SYNC",
      targetType: "Vehicle",
      targetId: vehicleId,
      vehicleId,
      teslaAccountId: ctx.teslaAccountId,
      status: AuditLogStatus.SUCCESS,
      summary: `Baseline 제원(specs_only) 성공 (${ctx.vin})`,
      metadata: {
        reason: RestSyncReason.BASELINE,
        vin: ctx.vin,
        ...specsAuditFields(specs),
      },
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
      summary: `Baseline 제원 실패 (wake 미시도): ${message}`,
      metadata: {
        reason: RestSyncReason.BASELINE,
        vin: ctx.vin,
        noWake: true,
        mode: "specs_only",
      },
    });
    return { ok: false, error: message, vehicleId };
  }
}

/** TRF-B2: ASLEEP→ONLINE 시 REST 없음 (Telemetry SoT). 레거시 full wake REST 폐기. */
export async function maybeRunWakeCooldownRestSync(
  vehicleId: string,
): Promise<RestSyncOnceResult> {
  return {
    ok: false,
    skipped: true,
    error: "wake_no_rest",
    vehicleId,
  };
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

/** 계정 내 Baseline 미완료 차량에 best-effort 1회씩 (wake 없음 · Freeze 예외) */
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

/**
 * TRF-B2 / NCS / B2e: 운행→P(또는 이동 보완) 후 nearby_charging_sites.
 * 성공 → 카탈로그 Upsert + Snapshot(TESLA_REST).
 * 실패 → 카탈로그 폴백(있으면 Snapshot CATALOG). 없으면 이전 nearby 유지(빈 덮어쓰기 금지).
 */
export async function maybeRefreshNearbyOnPark(
  vehicleId: string,
  options: { trigger?: ParkNearbyTrigger } = {},
): Promise<RestSyncOnceResult> {
  const trigger = options.trigger ?? null;
  const subscription = await prisma.telemetrySubscription.findUnique({
    where: { vehicleId },
    select: { active: true },
  });
  if (subscription && !subscription.active) {
    return { ok: false, skipped: true, error: "telemetry_disconnected", vehicleId };
  }

  const syncState = await prisma.vehicleSyncState.findUnique({ where: { vehicleId } });
  if (syncState?.lifecycle === VehicleLifecycle.TELEMETRY_DISCONNECTED) {
    return { ok: false, skipped: true, error: "telemetry_disconnected", vehicleId };
  }

  const cooldownMinutes = getRestWakeCooldownMinutes();
  if (!isRestWakeCooldownElapsed(syncState?.lastRestSyncAt, cooldownMinutes)) {
    return { ok: false, skipped: true, error: "wake_cooldown_active", vehicleId };
  }

  const ctx = await resolveTeslaUserId(vehicleId);
  if (!ctx) {
    return { ok: false, error: "vehicle_or_tesla_account_missing", vehicleId };
  }

  const previous = await prisma.vehicleSnapshot.findFirst({
    where: { vehicleId },
    orderBy: { lastUpdatedAt: "desc" },
  });
  if (!previous) {
    return { ok: false, skipped: true, error: "no_snapshot", vehicleId };
  }

  const client = new TeslaFleetClient(ctx.userId);
  try {
    const { sites, seeds } = await client.getNearbyChargingSitesResult(ctx.vin);
    await upsertChargingStationsFromSeeds(
      seeds.map((s) => ({
        ...s,
        siteType:
          s.siteType === "supercharger"
            ? ChargingStationSiteType.supercharger
            : ChargingStationSiteType.destination,
      })),
    );

    const now = new Date();
    await writeNearbyOnlySnapshot(previous, {
      nearbyJson: serializeNearbyChargingSites(sites, {
        capturedAt: now,
        capturedLat: previous.latitude,
        capturedLng: previous.longitude,
        source: "TESLA_REST",
      }),
      now,
    });

    await patchVehicleSyncState(vehicleId, {
      lastRestSyncAt: now,
      lastRestSyncReason: RestSyncReason.PARK_NEARBY,
    });

    await createAuditLog({
      action: "VEHICLE_NEARBY_REFRESH",
      targetType: "Vehicle",
      targetId: vehicleId,
      vehicleId,
      teslaAccountId: ctx.teslaAccountId,
      status: AuditLogStatus.SUCCESS,
      summary: `주차 후 인근충전소 갱신 (${ctx.vin})`,
      metadata: {
        mode: "park_nearby",
        source: "tesla_rest",
        vin: ctx.vin,
        siteCount: sites.length,
        seeded: seeds.length,
        reason: RestSyncReason.PARK_NEARBY,
        trigger,
      },
    });

    return { ok: true, reason: RestSyncReason.PARK_NEARBY, vehicleId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "nearby_refresh_failed";

    if (
      isNearbyCatalogFallbackEnabled() &&
      previous.latitude != null &&
      previous.longitude != null &&
      Number.isFinite(previous.latitude) &&
      Number.isFinite(previous.longitude)
    ) {
      const catalogSites = await queryNearbyFromCatalog(
        previous.latitude,
        previous.longitude,
      );

      if (catalogSites.length > 0) {
        const now = new Date();
        await writeNearbyOnlySnapshot(previous, {
          nearbyJson: serializeNearbyChargingSites(catalogSites, {
            capturedAt: now,
            capturedLat: previous.latitude,
            capturedLng: previous.longitude,
            source: "CATALOG",
          }),
          now,
        });

        await patchVehicleSyncState(vehicleId, {
          lastRestSyncAt: now,
          lastRestSyncReason: RestSyncReason.PARK_NEARBY,
        });

        await createAuditLog({
          action: "VEHICLE_NEARBY_REFRESH",
          targetType: "Vehicle",
          targetId: vehicleId,
          vehicleId,
          teslaAccountId: ctx.teslaAccountId,
          status: AuditLogStatus.SUCCESS,
          summary: `주차 후 인근충전소 카탈로그 폴백 (${ctx.vin})`,
          metadata: {
            mode: "park_nearby",
            source: "catalog_fallback",
            vin: ctx.vin,
            siteCount: catalogSites.length,
            restError: message,
            reason: RestSyncReason.PARK_NEARBY,
            trigger,
          },
        });

        return { ok: true, reason: RestSyncReason.PARK_NEARBY, vehicleId };
      }

      await createAuditLog({
        action: "VEHICLE_NEARBY_REFRESH",
        targetType: "Vehicle",
        targetId: vehicleId,
        vehicleId,
        teslaAccountId: ctx.teslaAccountId,
        status: AuditLogStatus.FAILURE,
        summary: `인근충전소 REST 실패 · 카탈로그 없음 (이전 목록 유지): ${message}`,
        metadata: {
          mode: "park_nearby",
          source: "empty",
          vin: ctx.vin,
          restError: message,
          preservedPrevious: true,
          trigger,
        },
      });
      return { ok: false, skipped: true, error: "catalog_empty", vehicleId };
    }

    await createAuditLog({
      action: "VEHICLE_NEARBY_REFRESH",
      targetType: "Vehicle",
      targetId: vehicleId,
      vehicleId,
      teslaAccountId: ctx.teslaAccountId,
      status: AuditLogStatus.FAILURE,
      summary: `인근 충전소 갱신 실패: ${message}`,
      metadata: {
        mode: "park_nearby",
        vin: ctx.vin,
        noWake: true,
        source: "empty",
        trigger,
      },
    });
    return { ok: false, error: message, vehicleId };
  }
}

async function writeNearbyOnlySnapshot(
  previous: VehicleSnapshot,
  options: { nearbyJson: string; now: Date },
) {
  const { nearbyJson, now } = options;
  await prisma.vehicleSnapshot.create({
    data: {
      vehicleId: previous.vehicleId,
      latitude: previous.latitude,
      longitude: previous.longitude,
      batteryPercent: previous.batteryPercent,
      rangeKm: previous.rangeKm,
      ignitionOn: previous.ignitionOn,
      status: previous.status,
      chargingStatus: previous.chargingStatus,
      odometerKm: previous.odometerKm,
      chargeLimitSoc: previous.chargeLimitSoc,
      chargerPowerKw: previous.chargerPowerKw,
      chargingPowerKind: previous.chargingPowerKind,
      shiftState: previous.shiftState,
      locked: previous.locked,
      doorsOpen: previous.doorsOpen,
      windowsOpen: previous.windowsOpen,
      doorDfOpen: previous.doorDfOpen,
      doorDrOpen: previous.doorDrOpen,
      doorPfOpen: previous.doorPfOpen,
      doorPrOpen: previous.doorPrOpen,
      frontTrunkOpen: previous.frontTrunkOpen,
      rearTrunkOpen: previous.rearTrunkOpen,
      insideTempC: previous.insideTempC,
      outsideTempC: previous.outsideTempC,
      climateOn: previous.climateOn,
      tpmsFrontLeft: previous.tpmsFrontLeft,
      tpmsFrontRight: previous.tpmsFrontRight,
      tpmsRearLeft: previous.tpmsRearLeft,
      tpmsRearRight: previous.tpmsRearRight,
      sentryMode: previous.sentryMode,
      serviceStatus: previous.serviceStatus,
      softwareVersion: previous.softwareVersion,
      ...pickCafSnapshotFields(previous),
      nearbyChargingSites: nearbyJson,
      lastTelemetryAt: previous.lastTelemetryAt,
      lastRestSyncAt: now,
      telemetrySource: previous.telemetrySource ?? TelemetrySource.MIXED,
      isAsleepInferred: previous.isAsleepInferred,
      sleepInferredAt: previous.sleepInferredAt,
      lastUpdatedAt: now,
    },
  });
}

/**
 * TRF-B2: Gear 보정 REST 폐기 — Telemetry Gear만 신뢰. (레거시 no-op)
 */
export async function maybeRunGearCorrectionRestSync(
  vehicleId: string,
): Promise<RestSyncOnceResult> {
  return {
    ok: false,
    skipped: true,
    error: "gear_rest_removed",
    vehicleId,
  };
}
