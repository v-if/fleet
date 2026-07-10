import { createHash } from "node:crypto";

import type { ChargingStatus, VehicleStatus } from "@prisma/client";

import type { ParsedTelemetryFields, TelemetryFieldValue, TelemetryMessage } from "./types";

function readNumber(value: TelemetryFieldValue | unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value !== "object") return undefined;

  const field = value as TelemetryFieldValue;
  if (field.doubleValue != null) return field.doubleValue;
  if (field.intValue != null) return field.intValue;
  if (field.longValue != null) return field.longValue;
  return undefined;
}

function readBoolean(value: TelemetryFieldValue | unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "object" || value == null) return undefined;
  const field = value as TelemetryFieldValue;
  if (field.booleanValue != null) return field.booleanValue;
  return undefined;
}

function readString(value: TelemetryFieldValue | unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value == null) return undefined;
  const field = value as TelemetryFieldValue;
  return field.stringValue;
}

function readLocation(
  value: TelemetryFieldValue | unknown,
): { latitude?: number; longitude?: number } | undefined {
  if (typeof value !== "object" || value == null) return undefined;
  const field = value as TelemetryFieldValue;
  if (field.locationValue) {
    return field.locationValue;
  }
  const record = value as Record<string, unknown>;
  if ("latitude" in record || "longitude" in record) {
    return {
      latitude: readNumber(record.latitude),
      longitude: readNumber(record.longitude),
    };
  }
  return undefined;
}

function mapChargingStatus(value: string | undefined): ChargingStatus | null {
  switch (value) {
    case "Charging":
    case "CHARGING":
      return "CHARGING";
    case "Complete":
    case "COMPLETE":
      return "COMPLETE";
    case "Stopped":
    case "STOPPED":
      return "STOPPED";
    case "Disconnected":
    case "DISCONNECTED":
      return "DISCONNECTED";
    default:
      return null;
  }
}

function hasUsableCoordinates(lat?: number | null, lng?: number | null) {
  return lat != null && lng != null && !(lat === 0 && lng === 0);
}

function flattenMessages(payload: unknown): TelemetryMessage[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as TelemetryMessage;
  if (Array.isArray(record.messages)) {
    return record.messages;
  }
  if (Array.isArray(record.records)) {
    return record.records;
  }
  if (Array.isArray(payload)) {
    return payload as TelemetryMessage[];
  }

  return [record];
}

function extractVin(message: TelemetryMessage): string | null {
  const vin = message.vin ?? message.VIN;
  if (!vin || typeof vin !== "string") return null;
  return vin.trim().toUpperCase();
}

function extractEventAt(message: TelemetryMessage): Date {
  const raw = message.createdAt ?? message.timestamp;
  if (typeof raw === "number") {
    const millis = raw > 1_000_000_000_000 ? raw : raw * 1000;
    return new Date(millis);
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function getDataField(
  data: Record<string, TelemetryFieldValue | unknown> | undefined,
  keys: string[],
): TelemetryFieldValue | unknown {
  if (!data) return undefined;
  for (const key of keys) {
    if (key in data) {
      return data[key];
    }
    const matched = Object.entries(data).find(
      ([entryKey]) => entryKey.toLowerCase() === key.toLowerCase(),
    );
    if (matched) {
      return matched[1];
    }
  }
  return undefined;
}

export function parseTelemetryMessage(message: TelemetryMessage): ParsedTelemetryFields | null {
  const vin = extractVin(message);
  if (!vin) return null;

  const data = message.data;
  const eventAt = extractEventAt(message);

  const location = readLocation(
    getDataField(data, ["Location", "location", "GPS", "GpsLocation"]),
  );
  const latitude = location?.latitude ?? null;
  const longitude = location?.longitude ?? null;

  const batteryPercent = readNumber(
    getDataField(data, ["Soc", "BatteryLevel", "ChargeState", "battery_level"]),
  );
  const rangeMiles = readNumber(
    getDataField(data, ["EstBatteryRange", "RatedRange", "est_battery_range"]),
  );
  const chargingRaw = readString(getDataField(data, ["ChargeState", "charging_state"]));
  const shiftState = readString(getDataField(data, ["ShiftState", "shift_state"]));
  const locked = readBoolean(getDataField(data, ["Locked", "locked"]));
  const doorsOpen = readBoolean(
    getDataField(data, ["DoorState", "door_open", "DoorsOpen"]),
  );
  const windowsOpen = readBoolean(
    getDataField(data, ["WindowState", "window_open", "WindowsOpen"]),
  );
  const insideTempC = readNumber(
    getDataField(data, ["InsideTemp", "inside_temp", "CabinTemp"]),
  );
  const outsideTempC = readNumber(
    getDataField(data, ["OutsideTemp", "outside_temp"]),
  );
  const climateOn = readBoolean(
    getDataField(data, ["HvacPower", "is_climate_on", "ClimateOn"]),
  );
  const odometerMiles = readNumber(getDataField(data, ["Odometer", "odometer"]));
  const sentryMode = readBoolean(getDataField(data, ["SentryMode", "sentry_mode"]));
  const softwareVersion = readString(
    getDataField(data, ["SoftwareVersion", "car_version", "Version"]),
  );

  let status: VehicleStatus | null = "ONLINE";
  if (batteryPercent !== undefined && batteryPercent < 15) {
    status = "ALERT";
  } else if (batteryPercent !== undefined && batteryPercent < 25) {
    status = "WARNING";
  }

  return {
    vin,
    eventAt,
    latitude: hasUsableCoordinates(latitude, longitude) ? latitude : null,
    longitude: hasUsableCoordinates(latitude, longitude) ? longitude : null,
    batteryPercent,
    rangeKm: rangeMiles != null ? Math.round(rangeMiles * 1.60934) : undefined,
    chargingStatus: chargingRaw ? mapChargingStatus(chargingRaw) : null,
    ignitionOn: shiftState != null ? shiftState !== "P" : null,
    locked: locked ?? null,
    doorsOpen: doorsOpen ?? null,
    windowsOpen: windowsOpen ?? null,
    insideTempC,
    outsideTempC,
    climateOn: climateOn ?? null,
    odometerKm: odometerMiles != null ? Math.round(odometerMiles * 1.60934) : undefined,
    sentryMode: sentryMode ?? null,
    softwareVersion,
    status,
  };
}

export function extractTelemetryMessages(payload: unknown): TelemetryMessage[] {
  return flattenMessages(payload);
}

export function buildIdempotencyKey(message: TelemetryMessage, payload: unknown) {
  const vin = extractVin(message);
  const eventAt = extractEventAt(message).toISOString();
  const digest = createHash("sha256")
    .update(JSON.stringify({ vin, eventAt, payload }))
    .digest("hex")
    .slice(0, 32);
  return `${vin ?? "unknown"}:${digest}`;
}

export function buildIngressIdempotencyKey(
  payload: unknown,
  headerKey?: string | null,
): string {
  if (headerKey?.trim()) {
    return headerKey.trim().slice(0, 128);
  }

  const digest = createHash("sha256")
    .update(typeof payload === "string" ? payload : JSON.stringify(payload))
    .digest("hex");
  return `payload:${digest}`;
}
