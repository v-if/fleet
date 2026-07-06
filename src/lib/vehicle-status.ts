import type { VehicleStatus } from "@prisma/client";

export const IDLE_DAYS_THRESHOLD = 7;

export const STATUS_LABEL: Record<VehicleStatus, string> = {
  ONLINE: "정상",
  OFFLINE: "오프라인",
  WARNING: "주의",
  ALERT: "이상",
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
