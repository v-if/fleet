import type { ChargingStatus, ServiceStatus, VehicleStatus } from "@prisma/client";

export const IDLE_DAYS_THRESHOLD = 7;

export const STATUS_LABEL: Record<VehicleStatus, string> = {
  ONLINE: "정상",
  OFFLINE: "오프라인",
  WARNING: "주의",
  ALERT: "이상",
};

export const CHARGING_STATUS_LABEL: Record<ChargingStatus, string> = {
  CHARGING: "충전중",
  COMPLETE: "충전 완료",
  DISCONNECTED: "미연결",
  STOPPED: "충전 중지",
};

export const STATUS_BADGE_VARIANT: Record<
  VehicleStatus,
  "success" | "secondary" | "warning" | "error"
> = {
  ONLINE: "success",
  OFFLINE: "secondary",
  WARNING: "warning",
  ALERT: "error",
};

export const CHARGING_STATUS_BADGE_VARIANT: Record<
  ChargingStatus,
  "info" | "success" | "secondary" | "outline"
> = {
  CHARGING: "info",
  COMPLETE: "success",
  DISCONNECTED: "secondary",
  STOPPED: "outline",
};

export const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  OK: "정상",
  DUE_SOON: "점검 예정",
  IN_SERVICE: "정비중",
};

export const SERVICE_STATUS_BADGE_VARIANT: Record<
  ServiceStatus,
  "success" | "warning" | "info"
> = {
  OK: "success",
  DUE_SOON: "warning",
  IN_SERVICE: "info",
};

export const STATUS_DOT_CLASS: Record<VehicleStatus, string> = {
  ONLINE: "bg-emerald-500",
  OFFLINE: "bg-zinc-400",
  WARNING: "bg-amber-500",
  ALERT: "bg-red-500",
};

export const STATUS_RING_CLASS: Record<VehicleStatus, string> = {
  ONLINE: "ring-emerald-500",
  OFFLINE: "ring-zinc-400",
  WARNING: "ring-amber-500",
  ALERT: "ring-red-500",
};

export const STATUS_GLOW_CLASS: Record<VehicleStatus, string> = {
  ONLINE: "shadow-emerald-500/40",
  OFFLINE: "shadow-zinc-400/30",
  WARNING: "shadow-amber-500/40",
  ALERT: "shadow-red-500/50",
};

export function isIdleForDays(
  status: VehicleStatus | null | undefined,
  lastUpdatedAt: Date | string | null,
  days: number,
): boolean {
  if (status === "OFFLINE") return true;
  if (!lastUpdatedAt) return false;

  const updated =
    typeof lastUpdatedAt === "string" ? new Date(lastUpdatedAt) : lastUpdatedAt;
  const thresholdMs = days * 24 * 60 * 60 * 1000;
  return Date.now() - updated.getTime() >= thresholdMs;
}

export function isIdleVehicle(
  status: VehicleStatus | null | undefined,
  lastUpdatedAt: Date | string | null,
): boolean {
  return isIdleForDays(status, lastUpdatedAt, IDLE_DAYS_THRESHOLD);
}

export function formatDateTime(value: Date | string | null) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("ko-KR");
}

export function formatOdometer(km: number | null | undefined) {
  if (km == null) return "-";
  return `${Math.round(km).toLocaleString("ko-KR")} km`;
}

export function isLowTpms(psi: number | null | undefined, threshold = 35) {
  return psi != null && psi < threshold;
}

export function formatTempC(temp: number | null | undefined) {
  if (temp == null) return "-";
  return `${temp.toFixed(1)}°C`;
}

export function formatLocationSummary(lat: number | null | undefined, lng: number | null | undefined) {
  if (!hasValidCoordinates(lat, lng)) {
    return "위치 데이터 없음";
  }
  return `${lat!.toFixed(4)}, ${lng!.toFixed(4)}`;
}

export function hasValidCoordinates(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function getIdleDurationLabel(lastUpdatedAt: Date | string | null) {
  if (!lastUpdatedAt) return "-";
  const updated =
    typeof lastUpdatedAt === "string" ? new Date(lastUpdatedAt) : lastUpdatedAt;
  const diffMs = Date.now() - updated.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간`;
  return "1시간 미만";
}

export function getAttentionReason(vehicle: {
  isIdle: boolean;
  snapshot: {
    status: VehicleStatus | null;
    batteryPercent: number | null;
    sentryMode: boolean | null;
    locked: boolean | null;
    doorsOpen: boolean | null;
    windowsOpen: boolean | null;
    tpmsFrontLeft: number | null;
    tpmsFrontRight: number | null;
    tpmsRearLeft: number | null;
    tpmsRearRight: number | null;
  } | null;
  recentEvents: { message: string }[];
}) {
  if (vehicle.recentEvents[0]) return vehicle.recentEvents[0].message;
  const snapshot = vehicle.snapshot;
  if (!snapshot) return "상태 정보 없음";
  if (vehicle.isIdle) return "장기 미운행";
  if (snapshot.batteryPercent != null && snapshot.batteryPercent < 20) {
    return "배터리 잔량 20% 미만";
  }
  if (snapshot.sentryMode) return "센트리 모드 활성";
  if (snapshot.locked === false) return "차량 잠금 해제";
  if (snapshot.doorsOpen) return "차량 문 개방";
  if (snapshot.windowsOpen) return "창문 개방";
  if (
    isLowTpms(snapshot.tpmsFrontLeft) ||
    isLowTpms(snapshot.tpmsFrontRight) ||
    isLowTpms(snapshot.tpmsRearLeft) ||
    isLowTpms(snapshot.tpmsRearRight)
  ) {
    return "타이어 공기압 이상";
  }
  return "주의 필요";
}
