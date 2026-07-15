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
  /** NCS: Tesla REST vs 카탈로그 폴백 */
  source?: "TESLA_REST" | "CATALOG" | null;
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
  /** `AC` | `DC` | null */
  chargingPowerKind: string | null;
  /** 정규화 P|R|N|D */
  shiftState: string | null;
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
  vehicleSpeedKmh: number | null;
  gpsHeading: number | null;
  detailedChargeState: string | null;
  timeToFullChargeHours: number | null;
  chargeAmps: number | null;
  chargePortDoorOpen: boolean | null;
  chargePortLatch: string | null;
  fastChargerPresent: boolean | null;
  tpmsHardWarnings: string | null;
  tpmsSoftWarnings: string | null;
  destinationName: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  minutesToArrival: number | null;
  milesToArrival: number | null;
  expectedEnergyPercentAtArrival: number | null;
  preconditioningEnabled: boolean | null;
  valetModeEnabled: boolean | null;
  serviceModeEnabled: boolean | null;
  softwareUpdateDownloadPercent: number | null;
  softwareUpdateInstallPercent: number | null;
  softwareUpdateVersion: string | null;
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
  firmwareVersion: string | null;
  roofColor: string | null;
  wheelType: string | null;
  chargePortType: string | null;
  driverAssist: string | null;
  exteriorTrim: string | null;
  /** Tier C — 필터된 vehicle_config */
  vehicleConfigJson: Record<string, unknown> | null;
  teslaVehicleId: string | null;
  accessType: string | null;
  specsSyncedAt: string | null;
  plateNumberEditedAt: string | null;
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
  /** 개발용 Telemetry 수신 모니터. flag OFF면 null */
  telemetryValueMonitor: {
    lines: Array<{
      displayAt: string;
      field: string;
      value: string;
      text: string;
      ingressId: string;
      occurredAt: string;
    }>;
  } | null;
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
