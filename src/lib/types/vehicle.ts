import type { ChargingStatus, EventType, ServiceStatus, VehicleStatus } from "@prisma/client";

export type NearbyChargingSiteDto = {
  name: string;
  distanceKm: number;
};

export type VehicleSnapshotDto = {
  id: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  batteryPercent: number | null;
  rangeKm: number | null;
  ignitionOn: boolean;
  status: VehicleStatus;
  chargingStatus: ChargingStatus;
  odometerKm: number | null;
  locked: boolean;
  doorsOpen: boolean;
  windowsOpen: boolean;
  insideTempC: number | null;
  outsideTempC: number | null;
  climateOn: boolean;
  tpmsFrontLeft: number | null;
  tpmsFrontRight: number | null;
  tpmsRearLeft: number | null;
  tpmsRearRight: number | null;
  sentryMode: boolean;
  serviceStatus: ServiceStatus;
  softwareVersion: string | null;
  nearbyChargingSites: NearbyChargingSiteDto[];
  lastUpdatedAt: string;
  createdAt: string;
};

export type VehicleEventDto = {
  id: string;
  vehicleId: string;
  type: EventType;
  message: string;
  occurredAt: string;
  resolvedAt: string | null;
  createdAt: string;
};

export type VehicleListItemDto = {
  id: string;
  plateNumber: string;
  model: string;
  year: number;
  oemVehicleId: string | null;
  snapshot: VehicleSnapshotDto | null;
  recentEvents: VehicleEventDto[];
  isIdle: boolean;
};

export type VehiclesResponse = {
  provider: string;
  count: number;
  lastUpdatedAt: string | null;
  summary: {
    total: number;
    online: number;
    warning: number;
    alert: number;
    offline: number;
    idle: number;
    charging: number;
  };
  vehicles: VehicleListItemDto[];
};

export type VehicleDetailDto = VehicleListItemDto & {
  createdAt: string;
  updatedAt: string;
  events: VehicleEventDto[];
};

export type VehicleDetailResponse = {
  provider: string;
  vehicle: VehicleDetailDto;
};

export type MapVehicle = {
  id: string;
  plateNumber: string;
  model: string;
  status: VehicleStatus;
  latitude: number;
  longitude: number;
  batteryPercent: number | null;
  ignitionOn: boolean;
  chargingStatus?: ChargingStatus;
};
