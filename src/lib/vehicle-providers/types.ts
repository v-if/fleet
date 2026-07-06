import type { EventType, VehicleStatus } from "@prisma/client";

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
