import type {
  ChargingStatus,
  EventType,
  ServiceStatus,
  VehicleStatus,
} from "@prisma/client";

export type NearbyChargingSite = {
  name: string;
  distanceKm: number;
};

export type VehicleSnapshotData = {
  plateNumber: string;
  model: string;
  year: number;
  oemVehicleId?: string;
  /** vehicle_config — Baseline/제원 갱신 시에만 Vehicle에 반영 */
  carType?: string | null;
  trimBadging?: string | null;
  exteriorColor?: string | null;
  teslaDisplayName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  batteryPercent?: number;
  rangeKm?: number;
  ignitionOn?: boolean | null;
  status?: VehicleStatus | null;
  chargingStatus?: ChargingStatus | null;
  odometerKm?: number;
  locked?: boolean | null;
  doorsOpen?: boolean | null;
  windowsOpen?: boolean | null;
  insideTempC?: number;
  outsideTempC?: number;
  climateOn?: boolean | null;
  tpmsFrontLeft?: number;
  tpmsFrontRight?: number;
  tpmsRearLeft?: number;
  tpmsRearRight?: number;
  sentryMode?: boolean | null;
  serviceStatus?: ServiceStatus | null;
  softwareVersion?: string;
  nearbyChargingSites?: NearbyChargingSite[];
  lastUpdatedAt: Date;
};

export type VehicleEventData = {
  plateNumber: string;
  type: EventType;
  message: string;
  occurredAt: Date;
};

export interface VehicleDataProvider {
  readonly name: string;
  fetchVehicles(): Promise<VehicleSnapshotData[]>;
  fetchVehicleDetail(plateNumber: string): Promise<VehicleSnapshotData | null>;
}
