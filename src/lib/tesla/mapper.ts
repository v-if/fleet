import type { ChargingStatus, EventType, VehicleStatus } from "@prisma/client";

import { getValidTeslaAccessToken } from "./auth";
import { getTeslaRegionConfig } from "./config";
import type {
  TeslaAlert,
  TeslaFleetStatusItem,
  TeslaFleetStatusResponse,
  TeslaRecentAlertsResponse,
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
      return "OFFLINE";
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

function derivePlateNumber(vin: string, displayName?: string | null) {
  const normalizedName = displayName?.replace(/\s/g, "").trim();
  if (normalizedName && KOREAN_PLATE_REGEX.test(normalizedName)) {
    return normalizedName;
  }
  return `TESLA-${vin.slice(-6).toUpperCase()}`;
}

function deriveModel(config?: TeslaVehicleDataResponse["response"]["vehicle_config"]) {
  const carType = config?.car_type ?? "Tesla";
  const trim = config?.trim_badging;
  if (trim) {
    return `${carType} ${trim}`;
  }
  return carType;
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
  const doorsOpen = hasDoorState
    ? Boolean(vehicle?.df || vehicle?.dr || vehicle?.pf || vehicle?.pr || closures?.door_open)
    : null;
  const hasWindowState =
    vehicle?.ft != null || vehicle?.rt != null || closures?.window_open != null;
  const windowsOpen = hasWindowState
    ? Boolean(vehicle?.ft || vehicle?.rt || closures?.window_open)
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

  return {
    plateNumber: derivePlateNumber(vin, data.display_name ?? listItem.display_name),
    model: deriveModel(data.vehicle_config),
    year: deriveYearFromVin(vin),
    oemVehicleId: vin,
    latitude,
    longitude,
    batteryPercent,
    rangeKm: rangeKm ? Math.round(rangeKm * 1.60934) : undefined,
    ignitionOn: drive?.shift_state != null ? drive.shift_state !== "P" : null,
    status,
    chargingStatus: charge?.charging_state ? mapChargingStatus(charge.charging_state) : null,
    odometerKm: vehicle?.odometer ? Math.round(vehicle.odometer * 1.60934) : undefined,
    locked: vehicle?.locked ?? null,
    doorsOpen,
    windowsOpen,
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

    const accessToken = await getValidTeslaAccessToken(this.userId);
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tesla Fleet API ${path} failed (${response.status}): ${errorText}`);
    }

    return (await response.json()) as T;
  }

  async listVehicles(): Promise<TeslaVehicleListItem[]> {
    const page = await this.request<TeslaVehicleListResponse>("/api/1/vehicles");
    return page.response ?? [];
  }

  async getFleetStatus(vins: string[]) {
    if (vins.length === 0) return [] as TeslaFleetStatusItem[];

    const data = await this.request<TeslaFleetStatusResponse>("/api/1/vehicles/fleet_status", {
      method: "POST",
      body: JSON.stringify({ vins }),
    });

    const vehicleInfo = data.response?.vehicle_info;

    if (Array.isArray(vehicleInfo)) {
      return vehicleInfo;
    }

    if (
      vehicleInfo &&
      typeof vehicleInfo === "object" &&
      "vehicle_info" in vehicleInfo &&
      Array.isArray(vehicleInfo.vehicle_info)
    ) {
      return vehicleInfo.vehicle_info;
    }

    if (vehicleInfo && typeof vehicleInfo === "object") {
      return Object.values(vehicleInfo).filter(
        (item): item is TeslaFleetStatusItem =>
          Boolean(item && typeof item === "object" && "vin" in item),
      );
    }

    return [];
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
}
