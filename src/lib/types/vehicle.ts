import type { ChargingStatus, EventType, ServiceStatus, VehicleStatus } from "@prisma/client";

export type NearbyChargingSiteDto = {
  name: string;
  distanceKm: number;
};

export type VehicleSnapshotDto = {
  id: string;
  vehicleId: string;
  latitude: number | null;
  longitude: number | null;
  batteryPercent: number | null;
  rangeKm: number | null;
  ignitionOn: boolean | null;
  status: VehicleStatus | null;
  chargingStatus: ChargingStatus | null;
  odometerKm: number | null;
  locked: boolean | null;
  doorsOpen: boolean | null;
  windowsOpen: boolean | null;
  insideTempC: number | null;
  outsideTempC: number | null;
  climateOn: boolean | null;
  tpmsFrontLeft: number | null;
  tpmsFrontRight: number | null;
  tpmsRearLeft: number | null;
  tpmsRearRight: number | null;
  sentryMode: boolean | null;
  serviceStatus: ServiceStatus | null;
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
  requestedProvider?: string;
  count: number;
  lastUpdatedAt: string | null;
  sync?: {
    lastSyncedAt: string | null;
    usedFallback: boolean;
    lastError: string | null;
  } | null;
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
  status: VehicleStatus | null;
  latitude: number | null;
  longitude: number | null;
  batteryPercent: number | null;
  ignitionOn: boolean | null;
  chargingStatus?: ChargingStatus | null;
};
