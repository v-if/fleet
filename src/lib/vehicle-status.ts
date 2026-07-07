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

export const CHARGING_STATUS_BADGE_VARIANT: Record<
  ChargingStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  CHARGING: "default",
  COMPLETE: "secondary",
  DISCONNECTED: "outline",
  STOPPED: "outline",
};

export const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  OK: "정상",
  DUE_SOON: "점검 예정",
  IN_SERVICE: "정비중",
};

export const SERVICE_STATUS_BADGE_VARIANT: Record<
  ServiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  OK: "default",
  DUE_SOON: "outline",
  IN_SERVICE: "secondary",
};

export const STATUS_BADGE_VARIANT: Record<
  VehicleStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ONLINE: "default",
  OFFLINE: "secondary",
  WARNING: "outline",
  ALERT: "destructive",
};

export const STATUS_DOT_CLASS: Record<VehicleStatus, string> = {
  ONLINE: "bg-emerald-500",
  OFFLINE: "bg-zinc-400",
  WARNING: "bg-amber-500",
  ALERT: "bg-red-500",
};

export function isIdleVehicle(
  status: VehicleStatus,
  lastUpdatedAt: Date | string | null,
): boolean {
  if (status === "OFFLINE") return true;
  if (!lastUpdatedAt) return false;

  const updated =
    typeof lastUpdatedAt === "string" ? new Date(lastUpdatedAt) : lastUpdatedAt;
  const thresholdMs = IDLE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000;
  return Date.now() - updated.getTime() >= thresholdMs;
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
