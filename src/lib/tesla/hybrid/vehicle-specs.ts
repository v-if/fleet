import { Prisma, RestSyncReason, VehicleLifecycle } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildDisplayModel } from "@/lib/tesla/display-model";
import {
  shouldPreservePlateNumber,
} from "@/lib/vehicle-display-name";
import {
  ensureVehicleSyncState,
  patchVehicleSyncState,
} from "@/lib/tesla/hybrid/sync-state";
import type {
  TeslaFleetStatusItem,
  TeslaVehicleDataResponse,
  TeslaVehicleListItem,
} from "@/lib/tesla/types";

/** TRF-B1 Tier C — vehicle_config 화이트리스트 (snake_case) */
export const VEHICLE_CONFIG_JSON_KEYS = [
  "efficiency_package",
  "motorized_charge_port",
  "has_air_suspension",
  "has_seat_cooling",
  "has_ludicrous_mode",
  "rear_seat_heaters",
  "third_row_seats",
  "interior_trim_type",
  "spoiler_type",
  "sun_roof_installed",
  "rhd",
  "eu_vehicle",
  "plg",
  "pws",
  "can_accept_navigation_requests",
  "can_actuate_trunks",
  "dashcam_clip_save_supported",
  "webcam_supported",
  "webcam_selfie_supported",
  "supports_qr_pairing",
  "performance_package",
  "rear_drive_unit",
  "headlamp_type",
  "exterior_trim_override",
  "paint_color_override",
  "use_range_badging",
  "utc_offset",
] as const;

const KOREAN_PLATE_REGEX = /^\d{2,3}[가-힣]\d{4}$/;

export type VehicleSpecsData = {
  plateNumber: string;
  year: number;
  oemVehicleId: string;
  carType: string | null;
  trimBadging: string | null;
  exteriorColor: string | null;
  teslaDisplayName: string | null;
  model: string;
  firmwareVersion: string | null;
  roofColor: string | null;
  wheelType: string | null;
  chargePortType: string | null;
  driverAssist: string | null;
  exteriorTrim: string | null;
  vehicleConfigJson: Prisma.InputJsonValue | typeof Prisma.JsonNull | null;
  teslaVehicleId: string | null;
  accessType: string | null;
};

export type WriteVehicleSpecsOptions = {
  teslaAccountId?: string | null;
  restSyncReason?: RestSyncReason;
  lastRestSyncAt?: Date;
};

function asString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function derivePlateNumber(vin: string, displayName?: string | null) {
  const normalizedName = displayName?.replace(/\s/g, "").trim();
  if (normalizedName && KOREAN_PLATE_REGEX.test(normalizedName)) {
    return normalizedName;
  }
  return `TESLA-${vin.slice(-6).toUpperCase()}`;
}

function deriveYearFromVin(vin: string) {
  const yearCode = vin[9];
  const mapping: Record<string, number> = {
    M: 2021,
    N: 2022,
    P: 2023,
    R: 2024,
    S: 2025,
    T: 2026,
  };
  return mapping[yearCode] ?? new Date().getFullYear();
}

function resolveTeslaVehicleId(listItem: TeslaVehicleListItem): string | null {
  if (listItem.id_s && String(listItem.id_s).trim()) {
    return String(listItem.id_s);
  }
  if (listItem.id != null) {
    return String(listItem.id);
  }
  return null;
}

export function pickVehicleConfigJson(
  config: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | null {
  if (!config) return null;
  const out: Record<string, unknown> = {};
  for (const key of VEHICLE_CONFIG_JSON_KEYS) {
    if (Object.prototype.hasOwnProperty.call(config, key) && config[key] !== undefined) {
      out[key] = config[key];
    }
  }
  return Object.keys(out).length > 0 ? (out as Prisma.InputJsonValue) : null;
}

/** vehicle_data(+list/fleet) → Tier A/B/C + Registry. 동적은 포함하지 않음. */
export function extractVehicleSpecs(
  listItem: TeslaVehicleListItem,
  data: TeslaVehicleDataResponse["response"],
  fleetStatus?: TeslaFleetStatusItem,
): VehicleSpecsData {
  const vin = (data.vin ?? listItem.vin).toUpperCase();
  const config = (data.vehicle_config ?? {}) as Record<string, unknown>;
  const carType = asString(config.car_type);
  const trimBadging = asString(config.trim_badging);
  const displayName =
    asString(data.display_name) ??
    asString(data.vehicle_state?.vehicle_name) ??
    asString(listItem.display_name);

  const displayModel =
    buildDisplayModel(carType, trimBadging) ??
    (carType ? `Tesla ${carType}` : "Tesla");

  const firmwareVersion =
    asString(data.vehicle_state?.car_version) ??
    asString(fleetStatus?.firmware_version);

  return {
    plateNumber: derivePlateNumber(vin, displayName),
    year: deriveYearFromVin(vin),
    oemVehicleId: vin,
    carType,
    trimBadging,
    exteriorColor: asString(config.exterior_color),
    teslaDisplayName: displayName,
    model: displayModel,
    firmwareVersion,
    roofColor: asString(config.roof_color),
    wheelType: asString(config.wheel_type),
    chargePortType: asString(config.charge_port_type),
    driverAssist: asString(config.driver_assist),
    exteriorTrim: asString(config.exterior_trim),
    vehicleConfigJson: pickVehicleConfigJson(config),
    teslaVehicleId: resolveTeslaVehicleId(listItem),
    accessType: asString(listItem.access_type),
  };
}

/**
 * TRF-B1: Vehicle 제원만 upsert · Snapshot 미생성.
 */
export async function writeVehicleSpecs(
  vehicleId: string,
  specs: VehicleSpecsData,
  options: WriteVehicleSpecsOptions = {},
) {
  const {
    teslaAccountId = null,
    restSyncReason = RestSyncReason.BASELINE,
    lastRestSyncAt = new Date(),
  } = options;

  const now = lastRestSyncAt;

  const existing = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { plateNumberEditedAt: true },
  });
  const preservePlateNumber = shouldPreservePlateNumber(existing?.plateNumberEditedAt);

  const vehicle = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      ...(preservePlateNumber ? {} : { plateNumber: specs.plateNumber }),
      year: specs.year,
      oemVehicleId: specs.oemVehicleId,
      teslaAccountId,
      unlinkedAt: null,
      isDeleted: false,
      carType: specs.carType,
      trimBadging: specs.trimBadging,
      exteriorColor: specs.exteriorColor,
      teslaDisplayName: specs.teslaDisplayName,
      model: specs.model,
      firmwareVersion: specs.firmwareVersion,
      roofColor: specs.roofColor,
      wheelType: specs.wheelType,
      chargePortType: specs.chargePortType,
      driverAssist: specs.driverAssist,
      exteriorTrim: specs.exteriorTrim,
      vehicleConfigJson:
        specs.vehicleConfigJson === null
          ? Prisma.JsonNull
          : specs.vehicleConfigJson,
      teslaVehicleId: specs.teslaVehicleId,
      accessType: specs.accessType,
      specsSyncedAt: now,
    },
  });

  await ensureVehicleSyncState(vehicle.id);

  const syncPatch: Parameters<typeof patchVehicleSyncState>[1] = {
    lastRestSyncAt: now,
    lastRestSyncReason: restSyncReason,
  };

  if (restSyncReason === RestSyncReason.BASELINE) {
    syncPatch.baselineCompletedAt = now;
    syncPatch.baselineLastError = null;
    syncPatch.lifecycle = VehicleLifecycle.READY;
  }

  if (restSyncReason === RestSyncReason.SPECS_REFRESH) {
    syncPatch.baselineLastError = null;
  }

  await patchVehicleSyncState(vehicle.id, syncPatch);

  return vehicle;
}

export function specsAuditFields(specs: VehicleSpecsData) {
  return {
    mode: "specs_only" as const,
    carType: specs.carType,
    trimBadging: specs.trimBadging,
    exteriorColor: specs.exteriorColor,
    firmwareVersion: specs.firmwareVersion,
    roofColor: specs.roofColor,
    wheelType: specs.wheelType,
    chargePortType: specs.chargePortType,
    driverAssist: specs.driverAssist,
    exteriorTrim: specs.exteriorTrim,
    hasVehicleConfigJson: specs.vehicleConfigJson != null,
    teslaVehicleId: specs.teslaVehicleId,
    accessType: specs.accessType,
  };
}
