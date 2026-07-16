import { ApiCallDirection } from "@prisma/client";
import type { ChargingStatus, EventType, ServiceStatus, VehicleStatus } from "@prisma/client";

import { createApiCallLog, createRequestId, sanitizeBody, sanitizeHeaders } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { buildDisplayModel } from "@/lib/tesla/display-model";
import { normalizeShiftState } from "@/lib/tesla/shift-state";
import { getValidTeslaAccessToken } from "./auth";
import { getTeslaRegionConfig } from "./config";
import type {
  TeslaAlert,
  TeslaFleetStatusItem,
  TeslaFleetStatusResponse,
  TeslaNearbyChargingSite,
  TeslaNearbyChargingSitesResponse,
  TeslaRecentAlertsResponse,
  TeslaServiceDataResponse,
  TeslaVehicleDataResponse,
  TeslaVehicleListItem,
  TeslaVehicleListResponse,
} from "./types";
import type { NearbyChargingSite, VehicleEventData, VehicleSnapshotData } from "../vehicle-providers/types";

const KOREAN_PLATE_REGEX = /^\d{2,3}[가-힣]\d{4}$/;

function mapVehicleStatus(state: string | undefined): VehicleStatus {
  switch (state) {
    case "online":
      return "ONLINE";
    case "asleep":
      return "ASLEEP";
    default:
      return "OFFLINE";
  }
}

function mapChargingStatus(value: string | undefined): ChargingStatus {
  switch (value) {
    case "Charging":
      return "CHARGING";
    case "Complete":
      return "COMPLETE";
    case "Stopped":
      return "STOPPED";
    default:
      return "DISCONNECTED";
  }
}

function mapServiceStatus(value: string | null | undefined): ServiceStatus | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("in_service") || normalized.includes("in-service")) {
    return "IN_SERVICE";
  }
  if (
    normalized.includes("due") ||
    normalized.includes("soon") ||
    normalized.includes("schedule")
  ) {
    return "DUE_SOON";
  }
  if (normalized.includes("ok") || normalized === "none" || normalized.includes("not")) {
    return "OK";
  }
  return "OK";
}

function openFlag(value: number | boolean | null | undefined): boolean | null {
  if (value == null) return null;
  return Boolean(value);
}

export function mapNearbyChargingSites(
  destination: TeslaNearbyChargingSite[] = [],
  superchargers: TeslaNearbyChargingSite[] = [],
): NearbyChargingSite[] {
  const mapOne = (
    site: TeslaNearbyChargingSite,
    fallbackType: "destination" | "supercharger",
  ): NearbyChargingSite | null => {
    const name = site.name?.trim();
    if (!name) return null;
    const miles = site.distance_miles;
    const lat = site.location?.lat;
    const lng = site.location?.long;
    const hasCoords =
      lat != null &&
      lng != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !(lat === 0 && lng === 0);
    const rawType = site.type?.toLowerCase();
    const siteType: "destination" | "supercharger" =
      rawType === "supercharger" || rawType === "destination"
        ? rawType
        : fallbackType;

    return {
      name,
      distanceKm:
        miles != null && Number.isFinite(miles)
          ? Math.round(miles * 1.60934 * 10) / 10
          : 0,
      latitude: hasCoords ? lat! : null,
      longitude: hasCoords ? lng! : null,
      siteType,
    };
  };

  const sites = [
    ...destination.map((s) => mapOne(s, "destination")),
    ...superchargers.map((s) => mapOne(s, "supercharger")),
  ]
    .filter((site): site is NearbyChargingSite => site != null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);

  return sites;
}

export type NearbyCatalogSeedFromTesla = {
  name: string;
  siteType: "destination" | "supercharger";
  latitude: number;
  longitude: number;
  totalStalls: number | null;
  lastAvailableStalls: number | null;
  siteClosed: boolean | null;
};

/** NCS — 좌표 있는 site만 카탈로그 씨드 */
export function extractNearbyCatalogSeeds(
  destination: TeslaNearbyChargingSite[] = [],
  superchargers: TeslaNearbyChargingSite[] = [],
): NearbyCatalogSeedFromTesla[] {
  const rows: NearbyCatalogSeedFromTesla[] = [];

  const push = (
    site: TeslaNearbyChargingSite,
    fallbackType: "destination" | "supercharger",
  ) => {
    const name = site.name?.trim();
    const lat = site.location?.lat;
    const lng = site.location?.long;
    if (!name || lat == null || lng == null) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat === 0 && lng === 0) return;

    const rawType = site.type?.toLowerCase();
    const siteType: "destination" | "supercharger" =
      rawType === "supercharger" || rawType === "destination"
        ? rawType
        : fallbackType;

    rows.push({
      name,
      siteType,
      latitude: lat,
      longitude: lng,
      totalStalls:
        site.total_stalls != null && Number.isFinite(site.total_stalls)
          ? Math.round(site.total_stalls)
          : null,
      lastAvailableStalls:
        site.available_stalls != null && Number.isFinite(site.available_stalls)
          ? Math.round(site.available_stalls)
          : null,
      siteClosed: typeof site.site_closed === "boolean" ? site.site_closed : null,
    });
  };

  for (const site of destination) push(site, "destination");
  for (const site of superchargers) push(site, "supercharger");
  return rows;
}

function derivePlateNumber(vin: string, displayName?: string | null) {
  const normalizedName = displayName?.replace(/\s/g, "").trim();
  if (normalizedName && KOREAN_PLATE_REGEX.test(normalizedName)) {
    return normalizedName;
  }
  return `TESLA-${vin.slice(-6).toUpperCase()}`;
}

function deriveModel(config?: TeslaVehicleDataResponse["response"]["vehicle_config"]) {
  const mapped = buildDisplayModel(config?.car_type, config?.trim_badging);
  if (mapped) return mapped;
  return "Tesla";
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

function hasUsableCoordinates(lat?: number | null, lng?: number | null) {
  return lat != null && lng != null && !(lat === 0 && lng === 0);
}

export function mapTeslaVehicleToSnapshot(
  listItem: TeslaVehicleListItem,
  data: TeslaVehicleDataResponse["response"],
  fleetStatus?: TeslaFleetStatusItem,
): VehicleSnapshotData {
  const vin = data.vin ?? listItem.vin;
  const charge = data.charge_state;
  const drive = data.drive_state;
  const vehicle = data.vehicle_state;
  const climate = data.climate_state;
  const closures = data.closures_state;
  const state = data.state ?? listItem.state;

  const batteryPercent = charge?.battery_level;
  const rangeKm = charge?.est_battery_range ?? charge?.battery_range;
  const latitude = hasUsableCoordinates(drive?.latitude, drive?.longitude)
    ? drive?.latitude ?? null
    : null;
  const longitude = hasUsableCoordinates(drive?.latitude, drive?.longitude)
    ? drive?.longitude ?? null
    : null;
  const hasTelemetry =
    batteryPercent !== undefined ||
    charge?.charging_state !== undefined ||
    drive?.shift_state !== undefined ||
    hasUsableCoordinates(latitude, longitude);
  const hasDoorState =
    vehicle?.df != null ||
    vehicle?.dr != null ||
    vehicle?.pf != null ||
    vehicle?.pr != null ||
    closures?.door_open != null;
  const doorDfOpen = openFlag(vehicle?.df);
  const doorDrOpen = openFlag(vehicle?.dr);
  const doorPfOpen = openFlag(vehicle?.pf);
  const doorPrOpen = openFlag(vehicle?.pr);
  const doorsOpen = hasDoorState
    ? Boolean(
        doorDfOpen ||
          doorDrOpen ||
          doorPfOpen ||
          doorPrOpen ||
          closures?.door_open,
      )
    : null;
  const windowsOpen =
    closures?.window_open != null ? Boolean(closures.window_open) : null;
  const frontTrunkOpen =
    vehicle?.ft != null || closures?.trunk_open != null
      ? Boolean(vehicle?.ft || closures?.trunk_open)
      : null;
  const rearTrunkOpen =
    vehicle?.rt != null || closures?.rear_trunk_open != null
      ? Boolean(vehicle?.rt || closures?.rear_trunk_open)
      : null;

  let status: VehicleStatus | null = state ? mapVehicleStatus(state) : null;
  if (!hasTelemetry) {
    status = state ? "OFFLINE" : null;
  }
  if (batteryPercent !== undefined && batteryPercent < 15) {
    status = "ALERT";
  } else if (batteryPercent !== undefined && batteryPercent < 25 && status === "ONLINE") {
    status = status === "ONLINE" ? "WARNING" : status;
  }

  const shiftState =
    drive?.shift_state !== undefined && drive?.shift_state !== null
      ? (normalizeShiftState(drive.shift_state) ?? null)
      : null;

  return {
    plateNumber: derivePlateNumber(vin, data.display_name ?? listItem.display_name),
    model: deriveModel(data.vehicle_config),
    year: deriveYearFromVin(vin),
    oemVehicleId: vin,
    carType: data.vehicle_config?.car_type ?? null,
    trimBadging: data.vehicle_config?.trim_badging ?? null,
    exteriorColor: data.vehicle_config?.exterior_color ?? null,
    teslaDisplayName: data.display_name ?? listItem.display_name ?? null,
    teslaVehicleId: listItem.id_s ?? (listItem.id != null ? String(listItem.id) : null),
    accessType: listItem.access_type ?? null,
    firmwareVersion: vehicle?.car_version ?? fleetStatus?.firmware_version ?? null,
    roofColor: data.vehicle_config?.roof_color ?? null,
    wheelType: data.vehicle_config?.wheel_type ?? null,
    chargePortType: data.vehicle_config?.charge_port_type ?? null,
    driverAssist: data.vehicle_config?.driver_assist ?? null,
    exteriorTrim: data.vehicle_config?.exterior_trim ?? null,
    latitude,
    longitude,
    batteryPercent,
    rangeKm: rangeKm ? Math.round(rangeKm * 1.60934) : undefined,
    shiftState,
    ignitionOn: shiftState != null ? shiftState !== "P" : null,
    status,
    chargingStatus: charge?.charging_state ? mapChargingStatus(charge.charging_state) : null,
    odometerKm: vehicle?.odometer ? Math.round(vehicle.odometer * 1.60934) : undefined,
    chargeLimitSoc: charge?.charge_limit_soc ?? null,
    chargerPowerKw: charge?.charger_power ?? null,
    locked: vehicle?.locked ?? null,
    doorsOpen,
    windowsOpen,
    doorDfOpen,
    doorDrOpen,
    doorPfOpen,
    doorPrOpen,
    frontTrunkOpen,
    rearTrunkOpen,
    insideTempC: climate?.inside_temp,
    outsideTempC: climate?.outside_temp,
    climateOn: climate?.is_climate_on ?? null,
    tpmsFrontLeft: vehicle?.tpms_pressure_fl,
    tpmsFrontRight: vehicle?.tpms_pressure_fr,
    tpmsRearLeft: vehicle?.tpms_pressure_rl,
    tpmsRearRight: vehicle?.tpms_pressure_rr,
    sentryMode: vehicle?.sentry_mode ?? null,
    serviceStatus: null,
    softwareVersion: vehicle?.car_version ?? fleetStatus?.firmware_version,
    nearbyChargingSites: [] as NearbyChargingSite[],
    lastUpdatedAt: new Date(),
  };
}

function mapAlertType(alert: TeslaAlert): EventType {
  const text = `${alert.name ?? ""} ${alert.user_text ?? ""}`.toLowerCase();
  if (text.includes("critical") || text.includes("fault")) {
    return "ALERT";
  }
  if (text.includes("offline") || text.includes("disconnect")) {
    return "OFFLINE";
  }
  return "WARNING";
}

export function mapTeslaAlertsToEvents(
  plateNumber: string,
  alerts: TeslaAlert[],
): VehicleEventData[] {
  return alerts.map((alert) => ({
    plateNumber,
    type: mapAlertType(alert),
    message: alert.user_text ?? alert.name ?? "Tesla alert",
    occurredAt: alert.time ? new Date(alert.time) : new Date(),
  }));
}

export class TeslaFleetClient {
  private readonly baseUrl: string;
  private readonly userId?: string;

  constructor(userId?: string) {
    this.baseUrl = getTeslaRegionConfig().fleetApiBase;
    this.userId = userId;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.userId) {
      throw new Error("Tesla user context is missing");
    }

    const startedAt = Date.now();
    const requestId = createRequestId();
    const teslaAccount = await prisma.teslaAccount.findFirst({
      where: {
        userId: this.userId,
        unlinkedAt: null,
      },
      select: { id: true },
      orderBy: { linkedAt: "desc" },
    });
    const accessToken = await getValidTeslaAccessToken(this.userId);
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const responseText = await response.text();

    await createApiCallLog({
      direction: ApiCallDirection.OUTBOUND,
      system: "TESLA",
      requestId,
      actorUserId: this.userId,
      teslaAccountId: teslaAccount?.id ?? null,
      method: init?.method ?? "GET",
      url: `${this.baseUrl}${path}`,
      path,
      statusCode: response.status,
      success: response.ok,
      durationMs: Date.now() - startedAt,
      requestHeaders: sanitizeHeaders({
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      }),
      requestBody: sanitizeBody(init?.body ? String(init.body) : null),
      responseHeaders: sanitizeHeaders(response.headers),
      responseBody: sanitizeBody(responseText),
      errorMessage: response.ok ? null : `Tesla Fleet API ${path} failed (${response.status})`,
    });

    if (!response.ok) {
      throw new Error(`Tesla Fleet API ${path} failed (${response.status}): ${responseText}`);
    }

    return JSON.parse(responseText) as T;
  }

  async listVehicles(): Promise<TeslaVehicleListItem[]> {
    const page = await this.request<TeslaVehicleListResponse>("/api/1/vehicles");
    return page.response ?? [];
  }

  async getFleetStatus(vins: string[]) {
    if (vins.length === 0) {
      return {
        items: [] as TeslaFleetStatusItem[],
        keyPairedVins: [] as string[],
        unpairedVins: [] as string[],
      };
    }

    const data = await this.request<TeslaFleetStatusResponse>("/api/1/vehicles/fleet_status", {
      method: "POST",
      body: JSON.stringify({ vins }),
    });

    const vehicleInfo = data.response?.vehicle_info;
    let items: TeslaFleetStatusItem[] = [];

    if (Array.isArray(vehicleInfo)) {
      items = vehicleInfo;
    } else if (
      vehicleInfo &&
      typeof vehicleInfo === "object" &&
      "vehicle_info" in vehicleInfo &&
      Array.isArray(vehicleInfo.vehicle_info)
    ) {
      items = vehicleInfo.vehicle_info;
    } else if (vehicleInfo && typeof vehicleInfo === "object") {
      items = Object.values(vehicleInfo).filter(
        (item): item is TeslaFleetStatusItem =>
          Boolean(item && typeof item === "object" && "vin" in item),
      );
    }

    return {
      items,
      keyPairedVins: data.response?.key_paired_vins ?? [],
      unpairedVins: data.response?.unpaired_vins ?? [],
    };
  }

  async getVehicleData(vin: string) {
    const data = await this.request<TeslaVehicleDataResponse>(
      `/api/1/vehicles/${vin}/vehicle_data`,
    );
    return data.response;
  }

  async getRecentAlerts(vin: string) {
    const data = await this.request<TeslaRecentAlertsResponse>(
      `/api/1/vehicles/${vin}/recent_alerts`,
    );
    return data.response?.recent_alerts ?? [];
  }

  async getNearbyChargingSitesResult(vin: string): Promise<{
    sites: NearbyChargingSite[];
    seeds: ReturnType<typeof extractNearbyCatalogSeeds>;
  }> {
    const data = await this.request<TeslaNearbyChargingSitesResponse>(
      `/api/1/vehicles/${encodeURIComponent(vin)}/nearby_charging_sites`,
    );
    if (!data.response) {
      const err = data.error?.trim() || "nearby_charging_sites empty response";
      throw new Error(err);
    }
    const destination = data.response.destination_charging ?? [];
    const superchargers = data.response.superchargers ?? [];
    return {
      sites: mapNearbyChargingSites(destination, superchargers),
      seeds: extractNearbyCatalogSeeds(destination, superchargers),
    };
  }

  /** @deprecated use getNearbyChargingSitesResult — 실패 시 [] 반환은 NCS에서 금지 */
  async getNearbyChargingSites(vin: string): Promise<NearbyChargingSite[]> {
    try {
      const result = await this.getNearbyChargingSitesResult(vin);
      return result.sites;
    } catch (error) {
      console.warn(`nearby_charging_sites failed for ${vin}:`, error);
      throw error;
    }
  }

  async getServiceStatus(vin: string): Promise<ServiceStatus | null> {
    try {
      const data = await this.request<TeslaServiceDataResponse>(
        `/api/1/vehicles/${encodeURIComponent(vin)}/service_data`,
      );
      return mapServiceStatus(data.response?.service_status);
    } catch (error) {
      console.warn(`service_data failed for ${vin}:`, error);
      return null;
    }
  }
}
