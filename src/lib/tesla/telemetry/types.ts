import type { ChargingStatus, VehicleStatus } from "@prisma/client";

/** Tesla Fleet Telemetry `Value` oneof (prefer_typed) + 문자열 폴백 */
export type TelemetryDoorsValue = {
  DriverFront?: boolean;
  DriverRear?: boolean;
  PassengerFront?: boolean;
  PassengerRear?: boolean;
  TrunkFront?: boolean;
  TrunkRear?: boolean;
  driverFront?: boolean;
  driverRear?: boolean;
  passengerFront?: boolean;
  passengerRear?: boolean;
  trunkFront?: boolean;
  trunkRear?: boolean;
};

export type TelemetryFieldValue = {
  stringValue?: string;
  intValue?: number;
  longValue?: number;
  doubleValue?: number;
  booleanValue?: boolean;
  locationValue?: {
    latitude?: number;
    longitude?: number;
  };
  /** prefer_typed oneof aliases (relay JSON) */
  doorValue?: TelemetryDoorsValue;
  shiftStateValue?: string | number;
  chargingValue?: string | number;
  sentryModeStateValue?: string | number;
  hvacPowerValue?: string | number;
  windowStateValue?: string | number;
};

export type TelemetryMessage = {
  vin?: string;
  VIN?: string;
  createdAt?: string;
  timestamp?: string | number;
  data?: Record<string, TelemetryFieldValue | unknown>;
  messages?: TelemetryMessage[];
  records?: TelemetryMessage[];
};

export type ParsedTelemetryFields = {
  vin: string;
  eventAt: Date;
  latitude?: number | null;
  longitude?: number | null;
  batteryPercent?: number;
  rangeKm?: number;
  chargingStatus?: ChargingStatus | null;
  /** Gear string when present (P/R/N/D) — BF-C 트리거용 */
  shiftState?: string | null;
  ignitionOn?: boolean | null;
  locked?: boolean | null;
  doorsOpen?: boolean | null;
  windowsOpen?: boolean | null;
  doorDfOpen?: boolean | null;
  doorDrOpen?: boolean | null;
  doorPfOpen?: boolean | null;
  doorPrOpen?: boolean | null;
  frontTrunkOpen?: boolean | null;
  rearTrunkOpen?: boolean | null;
  chargeLimitSoc?: number | null;
  chargerPowerKw?: number | null;
  /** AC=완속 · DC=급속 */
  chargingPowerKind?: "AC" | "DC" | null;
  insideTempC?: number;
  outsideTempC?: number;
  climateOn?: boolean | null;
  tpmsFrontLeft?: number | null;
  tpmsFrontRight?: number | null;
  tpmsRearLeft?: number | null;
  tpmsRearRight?: number | null;
  odometerKm?: number;
  sentryMode?: boolean | null;
  softwareVersion?: string;
  status?: VehicleStatus | null;
  /** DoorState 필드가 패킷에 포함됨 (닫힘 false 명시용) */
  doorStatePresent?: boolean;
};
