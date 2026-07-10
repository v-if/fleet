import type { ChargingStatus, VehicleStatus } from "@prisma/client";

export type TailAdminBadgeColor =
  | "primary"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "light"
  | "dark";

export function vehicleStatusBadgeColor(status: VehicleStatus): TailAdminBadgeColor {
  switch (status) {
    case "ONLINE":
      return "success";
    case "WARNING":
      return "warning";
    case "ALERT":
      return "error";
    case "OFFLINE":
      return "light";
    case "ASLEEP":
      return "info";
    default:
      return "light";
  }
}

export function chargingStatusBadgeColor(status: ChargingStatus): TailAdminBadgeColor {
  switch (status) {
    case "CHARGING":
      return "info";
    case "COMPLETE":
      return "success";
    case "STOPPED":
      return "warning";
    case "DISCONNECTED":
    default:
      return "light";
  }
}

export function providerLabel(provider: string) {
  if (provider === "tesla") return "Tesla Fleet API";
  if (provider === "mock") return "Mock Provider";
  return provider;
}

export function formatProviderTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}
