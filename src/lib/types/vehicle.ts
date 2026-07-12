import type {
  ChargingStatus,
  EventType,
  RestSyncReason,
  ServiceStatus,
  VehicleLifecycle,
  VehicleStatus,
} from "@prisma/client";

export type NearbyChargingSiteDto = {
  name: string;
  distanceKm: number;
};

export type NearbyChargingMetaDto = {
  capturedAt: string | null;
  capturedLat: number | null;
  capturedLng: number | null;
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
  chargeLimitSoc: number | null;
  chargerPowerKw: number | null;
  locked: boolean | null;
  doorsOpen: boolean | null;
  windowsOpen: boolean | null;
  doorDfOpen: boolean | null;
  doorDrOpen: boolean | null;
  doorPfOpen: boolean | null;
  doorPrOpen: boolean | null;
  frontTrunkOpen: boolean | null;
  rearTrunkOpen: boolean | null;
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
  nearbyChargingMeta: NearbyChargingMetaDto | null;
  lastTelemetryAt: string | null;
  lastRestSyncAt: string | null;
  telemetrySource: "TELEMETRY" | "REST" | "MIXED" | null;
  isAsleepInferred: boolean;
  sleepInferredAt: string | null;
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

/** Phase 4.4 — 온보딩·쿨다운 SoT */
export type VehicleSyncStateDto = {
  lifecycle: VehicleLifecycle;
  virtualKeyConfirmedAt: string | null;
  telemetryConfigSyncedAt: string | null;
  baselineCompletedAt: string | null;
  baselineLastError: string | null;
  lastRestSyncAt: string | null;
  lastRestSyncReason: RestSyncReason | null;
  lastWakeDetectedAt: string | null;
  updatedAt: string;
};

export type VehicleFreshnessDto = {
  lastTelemetryAt: string | null;
  /** SyncState SoT, 없으면 Snapshot 미러 */
  lastRestSyncAt: string | null;
  lastRestSyncReason: RestSyncReason | null;
  telemetrySource: "TELEMETRY" | "REST" | "MIXED" | null;
};

export type VehicleListItemDto = {
  id: string;
  plateNumber: string;
  model: string;
  year: number;
  oemVehicleId: string | null;
  carType: string | null;
  trimBadging: string | null;
  exteriorColor: string | null;
  teslaDisplayName: string | null;
  specsSyncedAt: string | null;
  syncState: VehicleSyncStateDto | null;
  freshness: VehicleFreshnessDto;
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
    asleep: number;
    idle: number;
    charging: number;
    telemetryDisconnected: number;
  };
  vehicles: VehicleListItemDto[];
};

export type VehicleTelemetrySubscriptionDto = {
  active: boolean;
  configSynced: boolean;
  configCheckedAt: string | null;
  subscribedAt: string;
  disconnectedAt: string | null;
  disconnectReason: "USER_SOFTWARE" | "VK_REMOVED_OFFLINE" | "UNLINK" | null;
  lastError: string | null;
};

export type VehicleDetailDto = VehicleListItemDto & {
  createdAt: string;
  updatedAt: string;
  events: VehicleEventDto[];
  telemetrySubscription: VehicleTelemetrySubscriptionDto | null;
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
  lifecycle?: VehicleLifecycle | null;
  carType?: string | null;
};
