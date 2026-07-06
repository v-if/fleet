import type { EventType, VehicleStatus } from "@prisma/client";

export type VehicleSnapshotDto = {
  id: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  batteryPercent: number | null;
  rangeKm: number | null;
  ignitionOn: boolean;
  status: VehicleStatus;
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
};
