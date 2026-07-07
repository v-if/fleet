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
  latitude: number;
  longitude: number;
  batteryPercent?: number;
  rangeKm?: number;
  ignitionOn: boolean;
  status: VehicleStatus;
  chargingStatus: ChargingStatus;
  odometerKm?: number;
  locked: boolean;
  doorsOpen: boolean;
  windowsOpen: boolean;
  insideTempC?: number;
  outsideTempC?: number;
  climateOn: boolean;
  tpmsFrontLeft?: number;
  tpmsFrontRight?: number;
  tpmsRearLeft?: number;
  tpmsRearRight?: number;
  sentryMode: boolean;
  serviceStatus: ServiceStatus;
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
