import { TelemetryIngressStatus, TelemetrySource, VehicleLifecycle } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { activeVehicleWhere } from "@/lib/vehicle-query";
import {
  maybeRefreshNearbyOnPark,
  maybeRunGearCorrectionRestSync,
  maybeRunWakeCooldownRestSync,
} from "@/lib/tesla/hybrid/rest-sync";
import { patchVehicleSyncState } from "@/lib/tesla/hybrid/sync-state";
import { shouldClearNearbyForLocation } from "@/lib/tesla/nearby-charging";

import { getTelemetryProcessBatchSize, getTelemetryStaleAfterMs, getTelemetryFreshnessMs } from "./config";
import { refreshTelemetryMetadataCounts } from "./ingress";
import { extractTelemetryMessages, parseTelemetryMessage } from "./mapper";
import type { ParsedTelemetryFields } from "./types";

async function findVehicleByVin(vin: string) {
  const normalized = vin.trim();
  return prisma.vehicle.findFirst({
    where: {
      oemVehicleId: { equals: normalized, mode: "insensitive" },
      ...activeVehicleWhere,
    },
    include: {
      snapshots: {
        orderBy: { lastUpdatedAt: "desc" },
        take: 1,
      },
    },
  });
}

function mergeSnapshotFields(
  current: ParsedTelemetryFields,
  previous:
    | {
        latitude: number | null;
        longitude: number | null;
        batteryPercent: number | null;
        rangeKm: number | null;
        ignitionOn: boolean | null;
        status: import("@prisma/client").VehicleStatus | null;
        chargingStatus: import("@prisma/client").ChargingStatus | null;
        odometerKm: number | null;
        locked: boolean | null;
        doorsOpen: boolean | null;
        windowsOpen: boolean | null;
        chargeLimitSoc?: number | null;
        chargerPowerKw?: number | null;
        shiftState?: string | null;
        doorDfOpen?: boolean | null;
        doorDrOpen?: boolean | null;
        doorPfOpen?: boolean | null;
        doorPrOpen?: boolean | null;
        frontTrunkOpen?: boolean | null;
        rearTrunkOpen?: boolean | null;
        insideTempC: number | null;
        outsideTempC: number | null;
        climateOn: boolean | null;
        tpmsFrontLeft: number | null;
        tpmsFrontRight: number | null;
        tpmsRearLeft: number | null;
        tpmsRearRight: number | null;
        sentryMode: boolean | null;
        serviceStatus: import("@prisma/client").ServiceStatus | null;
        softwareVersion: string | null;
        nearbyChargingSites: string | null;
      }
    | undefined,
) {
  const lat = current.latitude ?? previous?.latitude ?? null;
  const lng = current.longitude ?? previous?.longitude ?? null;
  let nearbyChargingSites = previous?.nearbyChargingSites ?? null;
  if (shouldClearNearbyForLocation(nearbyChargingSites, lat, lng)) {
    nearbyChargingSites = null;
  }

  return {
    latitude: lat,
    longitude: lng,
    batteryPercent: current.batteryPercent ?? previous?.batteryPercent ?? null,
    rangeKm: current.rangeKm ?? previous?.rangeKm ?? null,
    ignitionOn: current.ignitionOn ?? previous?.ignitionOn ?? null,
    status: current.status ?? previous?.status ?? "ONLINE",
    chargingStatus: current.chargingStatus ?? previous?.chargingStatus ?? null,
    odometerKm: current.odometerKm ?? previous?.odometerKm ?? null,
    locked: current.locked ?? previous?.locked ?? null,
    doorsOpen: current.doorsOpen ?? previous?.doorsOpen ?? null,
    windowsOpen: current.windowsOpen ?? previous?.windowsOpen ?? null,
    chargeLimitSoc: current.chargeLimitSoc ?? previous?.chargeLimitSoc ?? null,
    chargerPowerKw: current.chargerPowerKw ?? previous?.chargerPowerKw ?? null,
    shiftState: current.shiftState ?? previous?.shiftState ?? null,
    doorDfOpen: current.doorDfOpen ?? previous?.doorDfOpen ?? null,
    doorDrOpen: current.doorDrOpen ?? previous?.doorDrOpen ?? null,
    doorPfOpen: current.doorPfOpen ?? previous?.doorPfOpen ?? null,
    doorPrOpen: current.doorPrOpen ?? previous?.doorPrOpen ?? null,
    frontTrunkOpen: current.frontTrunkOpen ?? previous?.frontTrunkOpen ?? null,
    rearTrunkOpen: current.rearTrunkOpen ?? previous?.rearTrunkOpen ?? null,
    insideTempC: current.insideTempC ?? previous?.insideTempC ?? null,
    outsideTempC: current.outsideTempC ?? previous?.outsideTempC ?? null,
    climateOn: current.climateOn ?? previous?.climateOn ?? null,
    tpmsFrontLeft: current.tpmsFrontLeft ?? previous?.tpmsFrontLeft ?? null,
    tpmsFrontRight: current.tpmsFrontRight ?? previous?.tpmsFrontRight ?? null,
    tpmsRearLeft: current.tpmsRearLeft ?? previous?.tpmsRearLeft ?? null,
    tpmsRearRight: current.tpmsRearRight ?? previous?.tpmsRearRight ?? null,
    sentryMode: current.sentryMode ?? previous?.sentryMode ?? null,
    serviceStatus: previous?.serviceStatus ?? null,
    softwareVersion: current.softwareVersion ?? previous?.softwareVersion ?? null,
    nearbyChargingSites,
  };
}

async function applyTelemetryFields(vehicleId: string, fields: ParsedTelemetryFields) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      snapshots: {
        orderBy: { lastUpdatedAt: "desc" },
        take: 1,
      },
      syncState: true,
      telemetrySubscription: true,
    },
  });

  if (!vehicle) return null;

  const previous = vehicle.snapshots[0];
  const wasAsleep =
    previous?.isAsleepInferred === true || previous?.status === "ASLEEP";
  const previousIgnitionOn = previous?.ignitionOn;
  const merged = mergeSnapshotFields(fields, previous);

  await prisma.vehicleSnapshot.create({
    data: {
      vehicleId,
      ...merged,
      lastTelemetryAt: fields.eventAt,
      telemetrySource: TelemetrySource.TELEMETRY,
      isAsleepInferred: false,
      sleepInferredAt: null,
      lastUpdatedAt: fields.eventAt,
    },
  });

  // Vehicle 제원 컬럼은 Telemetry로 갱신하지 않음 (Phase 4.4.B)
  // 소프트웨어 단절 상태면 구독을 다시 활성화하지 않음 (Phase 4.5)
  const isDisconnected =
    vehicle.syncState?.lifecycle === VehicleLifecycle.TELEMETRY_DISCONNECTED ||
    (vehicle.telemetrySubscription != null &&
      vehicle.telemetrySubscription.active === false &&
      vehicle.telemetrySubscription.disconnectReason != null);

  if (!isDisconnected) {
    await prisma.telemetrySubscription.upsert({
      where: { vehicleId },
      update: {
        vin: fields.vin,
        teslaAccountId: vehicle.teslaAccountId,
        active: true,
        unsubscribedAt: null,
        lastError: null,
      },
      create: {
        vehicleId,
        vin: fields.vin,
        teslaAccountId: vehicle.teslaAccountId,
        active: true,
      },
    });
  }

  if (
    !isDisconnected &&
    (vehicle.syncState?.lifecycle === VehicleLifecycle.TELEMETRY_PENDING ||
      vehicle.syncState?.lifecycle === VehicleLifecycle.KEY_PENDING ||
      vehicle.syncState?.lifecycle === VehicleLifecycle.REGISTERED)
  ) {
    await patchVehicleSyncState(vehicleId, {
      lifecycle: VehicleLifecycle.READY,
      telemetryConfigSyncedAt:
        vehicle.syncState.telemetryConfigSyncedAt ?? fields.eventAt,
    });
  }

  // UX2-C: 스트림 수신이 확인되면 config 반영으로 간주 (Tesla synced GET 대기 없이)
  if (!isDisconnected) {
    const needsConfigMark =
      vehicle.telemetrySubscription?.configSynced !== true ||
      vehicle.syncState?.telemetryConfigSyncedAt == null;
    if (needsConfigMark) {
      await prisma.telemetrySubscription.updateMany({
        where: { vehicleId },
        data: {
          configSynced: true,
          configCheckedAt: fields.eventAt,
          lastError: null,
        },
      });
      if (vehicle.syncState?.telemetryConfigSyncedAt == null) {
        await patchVehicleSyncState(vehicleId, {
          telemetryConfigSyncedAt: fields.eventAt,
        });
      }
    }
  }

  if (wasAsleep && !isDisconnected) {
    await patchVehicleSyncState(vehicleId, {
      lastWakeDetectedAt: fields.eventAt,
    });

    try {
      await maybeRunWakeCooldownRestSync(vehicleId);
    } catch (error) {
      console.warn(`Wake cooldown REST sync failed for ${vehicleId}:`, error);
    }
  }

  // BF-C: P 정차 시 nearby 재조회 / P→비가동 시 선택적 보정 REST
  if (!isDisconnected && fields.shiftState != null) {
    const nowParked = fields.shiftState === "P";
    const nowDriving = fields.shiftState !== "P";

    if (nowParked) {
      try {
        await maybeRefreshNearbyOnPark(vehicleId);
      } catch (error) {
        console.warn(`Nearby refresh on park failed for ${vehicleId}:`, error);
      }
    } else if (nowDriving && previousIgnitionOn === false) {
      try {
        await maybeRunGearCorrectionRestSync(vehicleId);
      } catch (error) {
        console.warn(`Gear correction REST failed for ${vehicleId}:`, error);
      }
    }
  }

  return vehicle.id;
}

async function markIngress(
  ingressId: string,
  status: TelemetryIngressStatus,
  options: { errorMessage?: string; vehicleId?: string | null; vin?: string | null } = {},
) {
  await prisma.telemetryIngress.update({
    where: { id: ingressId },
    data: {
      status,
      vehicleId: options.vehicleId ?? undefined,
      vin: options.vin ?? undefined,
      errorMessage: options.errorMessage ?? null,
      processedAt: new Date(),
    },
  });
}

export async function processTelemetryIngressById(ingressId: string) {
  const ingress = await prisma.telemetryIngress.findUnique({
    where: { id: ingressId },
  });

  if (!ingress) {
    return { processed: false, reason: "not_found" as const };
  }

  if (
    ingress.status === TelemetryIngressStatus.PROCESSED ||
    ingress.status === TelemetryIngressStatus.DUPLICATE
  ) {
    return { processed: false, reason: "already_done" as const };
  }

  await prisma.telemetryIngress.update({
    where: { id: ingressId },
    data: { status: TelemetryIngressStatus.PROCESSING },
  });

  try {
    const messages = extractTelemetryMessages(ingress.payload);
    if (messages.length === 0) {
      await markIngress(ingressId, TelemetryIngressStatus.FAILED, {
        errorMessage: "No telemetry messages in payload",
      });
      return { processed: false, reason: "empty_payload" as const };
    }

    let lastVehicleId: string | null = null;
    let lastVin: string | null = null;

    for (const message of messages) {
      const parsed = parseTelemetryMessage(message);
      if (!parsed) continue;

      const vehicle = await findVehicleByVin(parsed.vin);
      if (!vehicle) {
        continue;
      }

      await applyTelemetryFields(vehicle.id, parsed);
      lastVehicleId = vehicle.id;
      lastVin = parsed.vin;
    }

    if (!lastVehicleId) {
      await markIngress(ingressId, TelemetryIngressStatus.FAILED, {
        errorMessage: "No matching active vehicle for telemetry payload",
        vin: ingress.vin,
      });
      return { processed: false, reason: "vehicle_not_found" as const };
    }

    await markIngress(ingressId, TelemetryIngressStatus.PROCESSED, {
      vehicleId: lastVehicleId,
      vin: lastVin,
    });

    await prisma.telemetryMetadata.upsert({
      where: { id: "default" },
      update: {
        lastProcessedAt: new Date(),
        lastError: null,
      },
      create: {
        id: "default",
        lastProcessedAt: new Date(),
      },
    });

    return { processed: true, vehicleId: lastVehicleId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telemetry processing failed";
    await markIngress(ingressId, TelemetryIngressStatus.FAILED, {
      errorMessage: message,
    });
    await prisma.telemetryMetadata.update({
      where: { id: "default" },
      data: { lastError: message },
    });
    throw error;
  } finally {
    await refreshTelemetryMetadataCounts();
  }
}

export async function processPendingTelemetryIngress(batchSize = getTelemetryProcessBatchSize()) {
  const pending = await prisma.telemetryIngress.findMany({
    where: { status: TelemetryIngressStatus.PENDING },
    orderBy: { receivedAt: "asc" },
    take: batchSize,
    select: { id: true },
  });

  const results = {
    attempted: pending.length,
    processed: 0,
    failed: 0,
  };

  for (const item of pending) {
    try {
      const result = await processTelemetryIngressById(item.id);
      if (result.processed) {
        results.processed += 1;
      } else if (result.reason === "vehicle_not_found" || result.reason === "empty_payload") {
        results.failed += 1;
      }
    } catch {
      results.failed += 1;
    }
  }

  return results;
}

export async function inferAsleepVehicles() {
  const staleBefore = new Date(Date.now() - getTelemetryStaleAfterMs());
  const vehicles = await prisma.vehicle.findMany({
    where: {
      ...activeVehicleWhere,
      oemVehicleId: { not: null },
      telemetrySubscription: { is: { active: true } },
    },
    include: {
      snapshots: {
        orderBy: { lastUpdatedAt: "desc" },
        take: 1,
      },
    },
  });

  let updated = 0;

  for (const vehicle of vehicles) {
    const snapshot = vehicle.snapshots[0];
    if (!snapshot) continue;

    const lastTelemetryAt = snapshot.lastTelemetryAt ?? snapshot.lastUpdatedAt;
    if (lastTelemetryAt > staleBefore) {
      if (snapshot.isAsleepInferred || snapshot.status === "ASLEEP") {
        await prisma.vehicleSnapshot.create({
          data: {
            vehicleId: vehicle.id,
            latitude: snapshot.latitude,
            longitude: snapshot.longitude,
            batteryPercent: snapshot.batteryPercent,
            rangeKm: snapshot.rangeKm,
            ignitionOn: snapshot.ignitionOn,
            status: "ONLINE",
            chargingStatus: snapshot.chargingStatus,
            odometerKm: snapshot.odometerKm,
            chargeLimitSoc: snapshot.chargeLimitSoc,
            chargerPowerKw: snapshot.chargerPowerKw,
            shiftState: snapshot.shiftState,
            locked: snapshot.locked,
            doorsOpen: snapshot.doorsOpen,
            windowsOpen: snapshot.windowsOpen,
            doorDfOpen: snapshot.doorDfOpen,
            doorDrOpen: snapshot.doorDrOpen,
            doorPfOpen: snapshot.doorPfOpen,
            doorPrOpen: snapshot.doorPrOpen,
            frontTrunkOpen: snapshot.frontTrunkOpen,
            rearTrunkOpen: snapshot.rearTrunkOpen,
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
            nearbyChargingSites: snapshot.nearbyChargingSites,
            lastTelemetryAt: snapshot.lastTelemetryAt,
            lastRestSyncAt: snapshot.lastRestSyncAt,
            telemetrySource: snapshot.telemetrySource,
            isAsleepInferred: false,
            sleepInferredAt: null,
            lastUpdatedAt: new Date(),
          },
        });
        updated += 1;
      }
      continue;
    }

    if (snapshot.status === "ASLEEP" && snapshot.isAsleepInferred) {
      continue;
    }

    await prisma.vehicleSnapshot.create({
      data: {
        vehicleId: vehicle.id,
        latitude: snapshot.latitude,
        longitude: snapshot.longitude,
        batteryPercent: snapshot.batteryPercent,
        rangeKm: snapshot.rangeKm,
        ignitionOn: false,
        status: "ASLEEP",
        chargingStatus: snapshot.chargingStatus,
        odometerKm: snapshot.odometerKm,
        chargeLimitSoc: snapshot.chargeLimitSoc,
        chargerPowerKw: snapshot.chargerPowerKw,
        shiftState: snapshot.shiftState,
        locked: snapshot.locked,
        doorsOpen: snapshot.doorsOpen,
        windowsOpen: snapshot.windowsOpen,
        doorDfOpen: snapshot.doorDfOpen,
        doorDrOpen: snapshot.doorDrOpen,
        doorPfOpen: snapshot.doorPfOpen,
        doorPrOpen: snapshot.doorPrOpen,
        frontTrunkOpen: snapshot.frontTrunkOpen,
        rearTrunkOpen: snapshot.rearTrunkOpen,
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
        nearbyChargingSites: snapshot.nearbyChargingSites,
        lastTelemetryAt: snapshot.lastTelemetryAt,
        lastRestSyncAt: snapshot.lastRestSyncAt,
        telemetrySource: snapshot.telemetrySource,
        isAsleepInferred: true,
        sleepInferredAt: new Date(),
        lastUpdatedAt: snapshot.lastUpdatedAt,
      },
    });
    updated += 1;
  }

  return { updated };
}

export function isTelemetryFresh(lastTelemetryAt: Date | null | undefined, now = Date.now()) {
  if (!lastTelemetryAt) return false;
  return now - lastTelemetryAt.getTime() < getTelemetryFreshnessMs();
}
