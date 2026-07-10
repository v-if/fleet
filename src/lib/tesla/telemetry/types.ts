import type { ChargingStatus, VehicleStatus } from "@prisma/client";

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
  ignitionOn?: boolean | null;
  locked?: boolean | null;
  doorsOpen?: boolean | null;
  windowsOpen?: boolean | null;
  insideTempC?: number;
  outsideTempC?: number;
  climateOn?: boolean | null;
  odometerKm?: number;
  sentryMode?: boolean | null;
  softwareVersion?: string;
  status?: VehicleStatus | null;
};
