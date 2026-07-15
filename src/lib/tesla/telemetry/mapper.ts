import { createHash } from "node:crypto";

import type { ChargingStatus, VehicleStatus } from "@prisma/client";

import { normalizeShiftState } from "@/lib/tesla/shift-state";
import { resolveChargingPowerFromTelemetry } from "@/lib/tesla/charging-power";

import type {
  ParsedTelemetryFields,
  TelemetryDoorsValue,
  TelemetryFieldValue,
  TelemetryMessage,
} from "./types";

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
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
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

function readUsableString(value: TelemetryFieldValue | unknown): string | undefined {
  const raw = readString(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed || /^invalid$/i.test(trimmed)) return undefined;
  return trimmed;
}

function readUsableEnumToken(value: TelemetryFieldValue | unknown): string | undefined {
  if (value == null) return undefined;
  const asString = readUsableString(value);
  if (asString) return asString;
  if (typeof value === "object") {
    const field = value as TelemetryFieldValue;
    const typed =
      enumToken(field.chargingValue) ??
      enumToken(field.stringValue) ??
      enumToken(
        field.intValue != null ? String(field.intValue) : undefined,
      );
    if (!typed || /^invalid$/i.test(typed)) return undefined;
    return typed;
  }
  return undefined;
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

function enumToken(value: string | number | undefined): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return String(value);
  return value.trim();
}

function mapChargingStatus(value: string | undefined): ChargingStatus | null {
  if (!value) return null;
  const normalized = value
    .replace(/^DetailedChargeState/i, "")
    .replace(/^ChargingState/i, "")
    .toUpperCase();
  switch (normalized) {
    case "CHARGING":
    case "ENABLE":
    case "STARTING":
    case "CONNECTED":
      return "CHARGING";
    case "COMPLETE":
    case "COMPLETED":
      return "COMPLETE";
    case "STOPPED":
    case "STOP":
      return "STOPPED";
    case "DISCONNECTED":
    case "IDLE":
    case "NOMINAL":
    case "UNKNOWN":
    case "INVALID":
      return "DISCONNECTED";
    default:
      return mapChargingStatusLegacy(value);
  }
}

function mapChargingStatusLegacy(value: string): ChargingStatus | null {
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

function readChargingStatus(
  value: TelemetryFieldValue | unknown,
): ChargingStatus | null | undefined {
  if (value == null) return undefined;
  const asString = readString(value);
  if (asString) return mapChargingStatus(asString);

  if (typeof value === "object") {
    const field = value as TelemetryFieldValue;
    const typed = enumToken(field.chargingValue);
    if (typed) return mapChargingStatus(typed);
  }
  return undefined;
}

/** ShiftState / Gear → P/R/N/D */
function readShiftState(value: TelemetryFieldValue | unknown): string | undefined {
  if (value == null) return undefined;
  const asString = readString(value);
  if (asString) {
    return normalizeShiftState(asString);
  }

  if (typeof value === "object") {
    const field = value as TelemetryFieldValue;
    const typed = enumToken(field.shiftStateValue);
    if (typed == null) return undefined;
    return normalizeShiftState(typed);
  }
  return undefined;
}

function readSentryMode(value: TelemetryFieldValue | unknown): boolean | undefined {
  const bool = readBoolean(value);
  if (bool != null) return bool;

  const asString = readString(value);
  const typed =
    asString ??
    (typeof value === "object" && value != null
      ? enumToken((value as TelemetryFieldValue).sentryModeStateValue)
      : undefined);
  if (!typed) return undefined;

  const token = typed.replace(/^SentryModeState/i, "").toUpperCase();
  if (["OFF", "UNKNOWN", "0", "1"].includes(token)) return false;
  if (["IDLE", "ARMED", "AWARE", "PANIC", "QUIET", "2", "3", "4", "5", "6"].includes(token)) {
    return true;
  }
  return undefined;
}

function readHvacPowerOn(value: TelemetryFieldValue | unknown): boolean | undefined {
  const bool = readBoolean(value);
  if (bool != null) return bool;

  const asString = readString(value);
  const typed =
    asString ??
    (typeof value === "object" && value != null
      ? enumToken((value as TelemetryFieldValue).hvacPowerValue)
      : undefined);
  if (!typed) return undefined;

  const token = typed.replace(/^HvacPowerState/i, "").toUpperCase();
  if (["OFF", "UNKNOWN", "0", "1"].includes(token)) return false;
  if (["ON", "PRECONDITION", "OVERHEATPROTECT", "2", "3", "4"].includes(token)) {
    return true;
  }
  return undefined;
}

function isWindowOpen(value: TelemetryFieldValue | unknown): boolean | undefined {
  const bool = readBoolean(value);
  if (bool != null) return bool;

  const asString = readString(value);
  const typed =
    asString ??
    (typeof value === "object" && value != null
      ? enumToken((value as TelemetryFieldValue).windowStateValue)
      : undefined);
  if (!typed) return undefined;

  const token = typed.replace(/^WindowState/i, "").toUpperCase();
  if (["CLOSED", "UNKNOWN", "0", "1"].includes(token)) return false;
  if (["PARTIALLYOPEN", "OPENED", "OPEN", "2", "3"].includes(token)) return true;
  return undefined;
}

function doorFlag(
  doors: TelemetryDoorsValue,
  ...keys: (keyof TelemetryDoorsValue)[]
): boolean {
  return keys.some((key) => Boolean(doors[key]));
}

export type ParsedDoorState = {
  doorDfOpen: boolean;
  doorDrOpen: boolean;
  doorPfOpen: boolean;
  doorPrOpen: boolean;
  frontTrunkOpen: boolean;
  rearTrunkOpen: boolean;
  doorsOpen: boolean;
};

/** DoorState: string `DriverFront|…` / Doors object / typed doorValue */
export function parseDoorState(
  value: TelemetryFieldValue | unknown,
): ParsedDoorState | undefined {
  if (value == null) return undefined;

  let doors: TelemetryDoorsValue | null = null;

  if (typeof value === "string") {
    const tokens = value
      .split(/[|,+\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    doors = {};
    for (const token of tokens) {
      const key = token.replace(/\s/g, "");
      if (/^DriverFront$/i.test(key) || /^df$/i.test(key)) doors.DriverFront = true;
      else if (/^DriverRear$/i.test(key) || /^dr$/i.test(key)) doors.DriverRear = true;
      else if (/^PassengerFront$/i.test(key) || /^pf$/i.test(key)) doors.PassengerFront = true;
      else if (/^PassengerRear$/i.test(key) || /^pr$/i.test(key)) doors.PassengerRear = true;
      else if (/^TrunkFront$/i.test(key) || /^ft$/i.test(key) || /^Frunk$/i.test(key)) {
        doors.TrunkFront = true;
      } else if (/^TrunkRear$/i.test(key) || /^rt$/i.test(key) || /^Trunk$/i.test(key)) {
        doors.TrunkRear = true;
      }
    }
  } else if (typeof value === "object") {
    const field = value as TelemetryFieldValue & TelemetryDoorsValue;
    if (field.doorValue) {
      doors = field.doorValue;
    } else if (
      "DriverFront" in field ||
      "driverFront" in field ||
      "TrunkFront" in field ||
      "trunkFront" in field
    ) {
      doors = field as TelemetryDoorsValue;
    } else if (field.stringValue != null) {
      return parseDoorState(field.stringValue);
    } else if (field.booleanValue != null) {
      // legacy boolean — 종합만
      return {
        doorDfOpen: field.booleanValue,
        doorDrOpen: false,
        doorPfOpen: false,
        doorPrOpen: false,
        frontTrunkOpen: false,
        rearTrunkOpen: false,
        doorsOpen: field.booleanValue,
      };
    }
  }

  if (!doors) return undefined;

  const doorDfOpen = doorFlag(doors, "DriverFront", "driverFront");
  const doorDrOpen = doorFlag(doors, "DriverRear", "driverRear");
  const doorPfOpen = doorFlag(doors, "PassengerFront", "passengerFront");
  const doorPrOpen = doorFlag(doors, "PassengerRear", "passengerRear");
  const frontTrunkOpen = doorFlag(doors, "TrunkFront", "trunkFront");
  const rearTrunkOpen = doorFlag(doors, "TrunkRear", "trunkRear");

  return {
    doorDfOpen,
    doorDrOpen,
    doorPfOpen,
    doorPrOpen,
    frontTrunkOpen,
    rearTrunkOpen,
    doorsOpen: doorDfOpen || doorDrOpen || doorPfOpen || doorPrOpen,
  };
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

function hasDataField(
  data: Record<string, TelemetryFieldValue | unknown> | undefined,
  keys: string[],
): boolean {
  return getDataField(data, keys) !== undefined;
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

  // ChargeState는 SoC 키에서 제외 (BF-A2)
  const batteryPercent = readNumber(
    getDataField(data, ["Soc", "BatteryLevel", "battery_level"]),
  );
  const rangeMiles = readNumber(
    getDataField(data, ["EstBatteryRange", "RatedRange", "est_battery_range"]),
  );
  const detailedRaw = getDataField(data, ["DetailedChargeState"]);
  const chargeStateRaw = getDataField(data, ["ChargeState", "charging_state"]);
  const detailedChargeStatus = readChargingStatus(detailedRaw);
  const basicChargeStatus = readChargingStatus(chargeStateRaw);
  const chargingStatus = detailedChargeStatus ?? basicChargeStatus;
  const detailedChargeState = readUsableEnumToken(detailedRaw) ?? null;

  const shiftState = readShiftState(
    getDataField(data, ["Gear", "ShiftState", "shift_state", "gear"]),
  );
  const locked = readBoolean(getDataField(data, ["Locked", "locked"]));

  const doorRaw = getDataField(data, ["DoorState", "door_open", "DoorsOpen"]);
  const doorStatePresent = doorRaw !== undefined;
  const doorParsed = parseDoorState(doorRaw);

  const windowStates = [
    isWindowOpen(getDataField(data, ["FdWindow", "fd_window"])),
    isWindowOpen(getDataField(data, ["FpWindow", "fp_window"])),
    isWindowOpen(getDataField(data, ["RdWindow", "rd_window"])),
    isWindowOpen(getDataField(data, ["RpWindow", "rp_window"])),
  ];
  const anyWindowPresent = windowStates.some((v) => v !== undefined);
  const windowsOpen = anyWindowPresent
    ? windowStates.some((v) => v === true)
    : undefined;

  const insideTempC = readNumber(
    getDataField(data, ["InsideTemp", "inside_temp", "CabinTemp"]),
  );
  const outsideTempC = readNumber(
    getDataField(data, ["OutsideTemp", "outside_temp"]),
  );
  const climateOn = readHvacPowerOn(
    getDataField(data, ["HvacPower", "is_climate_on", "ClimateOn"]),
  );
  const odometerMiles = readNumber(getDataField(data, ["Odometer", "odometer"]));
  const sentryMode = readSentryMode(getDataField(data, ["SentryMode", "sentry_mode"]));
  // REST-1: Version 구독 제거 — 잔여 패킷 키만 허용
  const softwareVersion = readUsableString(
    getDataField(data, ["Version", "SoftwareVersion", "car_version"]),
  );

  const chargeLimitSoc = readNumber(
    getDataField(data, ["ChargeLimitSoc", "charge_limit_soc"]),
  );
  const acPower = readNumber(getDataField(data, ["ACChargingPower", "ac_charging_power"]));
  const dcPower = readNumber(getDataField(data, ["DCChargingPower", "dc_charging_power"]));
  const chargingPower = resolveChargingPowerFromTelemetry(acPower, dcPower);
  const chargerPowerKw = chargingPower?.chargerPowerKw;
  const chargingPowerKind = chargingPower?.chargingPowerKind;

  const tpmsFrontLeft = readNumber(
    getDataField(data, ["TpmsPressureFl", "tpms_pressure_fl"]),
  );
  const tpmsFrontRight = readNumber(
    getDataField(data, ["TpmsPressureFr", "tpms_pressure_fr"]),
  );
  const tpmsRearLeft = readNumber(
    getDataField(data, ["TpmsPressureRl", "tpms_pressure_rl"]),
  );
  const tpmsRearRight = readNumber(
    getDataField(data, ["TpmsPressureRr", "tpms_pressure_rr"]),
  );

  const speedMph = readNumber(getDataField(data, ["VehicleSpeed", "vehicle_speed"]));
  const vehicleSpeedKmh =
    speedMph != null ? Math.round(speedMph * 1.60934 * 10) / 10 : undefined;
  const gpsHeading = readNumber(getDataField(data, ["GpsHeading", "heading"]));
  const timeToFullChargeHours = readNumber(
    getDataField(data, ["TimeToFullCharge", "time_to_full_charge"]),
  );
  const chargeAmps = readNumber(getDataField(data, ["ChargeAmps", "charge_amps"]));
  const chargePortDoorOpen = readBoolean(
    getDataField(data, ["ChargePortDoorOpen", "charge_port_door_open"]),
  );
  const chargePortLatch = readUsableEnumToken(
    getDataField(data, ["ChargePortLatch", "charge_port_latch"]),
  );
  const fastChargerPresent = readBoolean(
    getDataField(data, ["FastChargerPresent", "fast_charger_present"]),
  );
  const tpmsHardWarnings = readUsableEnumToken(
    getDataField(data, ["TpmsHardWarnings", "tpms_hard_warning"]),
  );
  const tpmsSoftWarnings = readUsableEnumToken(
    getDataField(data, ["TpmsSoftWarnings", "tpms_soft_warning"]),
  );
  const destinationName = readUsableString(
    getDataField(data, ["DestinationName", "destination_name"]),
  );
  const destLoc = readLocation(
    getDataField(data, ["DestinationLocation", "destination_location"]),
  );
  const minutesToArrival = readNumber(
    getDataField(data, ["MinutesToArrival", "minutes_to_arrival"]),
  );
  const milesToArrival = readNumber(
    getDataField(data, ["MilesToArrival", "miles_to_arrival"]),
  );
  const expectedEnergyPercentAtArrival = readNumber(
    getDataField(data, [
      "ExpectedEnergyPercentAtTripArrival",
      "expected_energy_percent_at_trip_arrival",
    ]),
  );
  const preconditioningEnabled = readBoolean(
    getDataField(data, ["PreconditioningEnabled", "preconditioning_enabled"]),
  );
  const valetModeEnabled = readBoolean(
    getDataField(data, ["ValetModeEnabled", "valet_mode"]),
  );
  const serviceModeEnabled = readBoolean(
    getDataField(data, ["ServiceMode", "service_mode"]),
  );
  const softwareUpdateDownloadPercent = readNumber(
    getDataField(data, ["SoftwareUpdateDownloadPercentComplete"]),
  );
  const softwareUpdateInstallPercent = readNumber(
    getDataField(data, ["SoftwareUpdateInstallationPercentComplete"]),
  );
  const softwareUpdateVersion = readUsableString(
    getDataField(data, ["SoftwareUpdateVersion"]),
  );

  let status: VehicleStatus | null = "ONLINE";
  if (batteryPercent !== undefined && batteryPercent < 15) {
    status = "ALERT";
  } else if (batteryPercent !== undefined && batteryPercent < 25) {
    status = "WARNING";
  }

  // DoorState가 있으면 닫힘도 false로 명시 (merge 보존 방지)
  const doorFields =
    doorStatePresent && doorParsed
      ? {
          doorsOpen: doorParsed.doorsOpen,
          doorDfOpen: doorParsed.doorDfOpen,
          doorDrOpen: doorParsed.doorDrOpen,
          doorPfOpen: doorParsed.doorPfOpen,
          doorPrOpen: doorParsed.doorPrOpen,
          frontTrunkOpen: doorParsed.frontTrunkOpen,
          rearTrunkOpen: doorParsed.rearTrunkOpen,
          doorStatePresent: true as const,
        }
      : doorStatePresent
        ? {
            doorsOpen: false,
            doorDfOpen: false,
            doorDrOpen: false,
            doorPfOpen: false,
            doorPrOpen: false,
            frontTrunkOpen: false,
            rearTrunkOpen: false,
            doorStatePresent: true as const,
          }
        : {};

  return {
    vin,
    eventAt,
    latitude: hasUsableCoordinates(latitude, longitude) ? latitude : null,
    longitude: hasUsableCoordinates(latitude, longitude) ? longitude : null,
    batteryPercent,
    rangeKm: rangeMiles != null ? Math.round(rangeMiles * 1.60934) : undefined,
    chargingStatus,
    shiftState: shiftState ?? null,
    ignitionOn: shiftState != null ? shiftState !== "P" : null,
    locked: locked ?? null,
    windowsOpen: windowsOpen ?? null,
    ...doorFields,
    chargeLimitSoc: chargeLimitSoc ?? null,
    chargerPowerKw: chargerPowerKw ?? null,
    chargingPowerKind: chargingPowerKind ?? null,
    insideTempC,
    outsideTempC,
    climateOn: climateOn ?? null,
    tpmsFrontLeft: tpmsFrontLeft ?? null,
    tpmsFrontRight: tpmsFrontRight ?? null,
    tpmsRearLeft: tpmsRearLeft ?? null,
    tpmsRearRight: tpmsRearRight ?? null,
    odometerKm: odometerMiles != null ? Math.round(odometerMiles * 1.60934) : undefined,
    sentryMode: sentryMode ?? null,
    softwareVersion,
    status,
    vehicleSpeedKmh: vehicleSpeedKmh ?? null,
    gpsHeading: gpsHeading ?? null,
    detailedChargeState: detailedChargeState ?? null,
    timeToFullChargeHours: timeToFullChargeHours ?? null,
    chargeAmps: chargeAmps ?? null,
    chargePortDoorOpen: chargePortDoorOpen ?? null,
    chargePortLatch: chargePortLatch ?? null,
    fastChargerPresent: fastChargerPresent ?? null,
    tpmsHardWarnings: tpmsHardWarnings ?? null,
    tpmsSoftWarnings: tpmsSoftWarnings ?? null,
    destinationName: destinationName ?? null,
    destinationLatitude: hasUsableCoordinates(
      destLoc?.latitude ?? null,
      destLoc?.longitude ?? null,
    )
      ? (destLoc?.latitude ?? null)
      : null,
    destinationLongitude: hasUsableCoordinates(
      destLoc?.latitude ?? null,
      destLoc?.longitude ?? null,
    )
      ? (destLoc?.longitude ?? null)
      : null,
    minutesToArrival: minutesToArrival ?? null,
    milesToArrival: milesToArrival ?? null,
    expectedEnergyPercentAtArrival: expectedEnergyPercentAtArrival ?? null,
    preconditioningEnabled: preconditioningEnabled ?? null,
    valetModeEnabled: valetModeEnabled ?? null,
    serviceModeEnabled: serviceModeEnabled ?? null,
    softwareUpdateDownloadPercent:
      softwareUpdateDownloadPercent != null
        ? Math.round(softwareUpdateDownloadPercent)
        : null,
    softwareUpdateInstallPercent:
      softwareUpdateInstallPercent != null
        ? Math.round(softwareUpdateInstallPercent)
        : null,
    softwareUpdateVersion: softwareUpdateVersion ?? null,
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
