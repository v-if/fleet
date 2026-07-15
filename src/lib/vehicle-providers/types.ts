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
  /** Fleet list registry (TRF-B1) */
  teslaVehicleId?: string | null;
  accessType?: string | null;
  firmwareVersion?: string | null;
  roofColor?: string | null;
  wheelType?: string | null;
  chargePortType?: string | null;
  driverAssist?: string | null;
  exteriorTrim?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  batteryPercent?: number;
  rangeKm?: number;
  ignitionOn?: boolean | null;
  status?: VehicleStatus | null;
  chargingStatus?: ChargingStatus | null;
  odometerKm?: number;
  chargeLimitSoc?: number | null;
  chargerPowerKw?: number | null;
  /** AC | DC — Telemetry. REST는 보통 null */
  chargingPowerKind?: string | null;
  /** 정규화 P|R|N|D — drive_state.shift_state / Gear */
  shiftState?: string | null;
  locked?: boolean | null;
  doorsOpen?: boolean | null;
  windowsOpen?: boolean | null;
  doorDfOpen?: boolean | null;
  doorDrOpen?: boolean | null;
  doorPfOpen?: boolean | null;
  doorPrOpen?: boolean | null;
  frontTrunkOpen?: boolean | null;
  rearTrunkOpen?: boolean | null;
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
