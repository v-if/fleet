import type { ChargingStatus, VehicleStatus } from "@prisma/client";

import type { VehicleDetailDto, VehicleSnapshotDto } from "@/lib/types/vehicle";
import { isLowTpms } from "@/lib/vehicle-status";

export type VehicleOpsMode =
  | "DRIVING"
  | "CHARGING"
  | "STANDBY"
  | "ASLEEP"
  | "OFFLINE"
  | "UNKNOWN";

export type OpsSummaryItem = {
  tone: "ok" | "warn" | "info";
  text: string;
};

const ATM_TO_PSI = 14.7;

export function convertTeslaTpmsToPsi(
  value: number | null | undefined,
  provider: string,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (provider === "tesla" && value > 0 && value < 10) {
    return Math.round(value * ATM_TO_PSI * 10) / 10;
  }
  return value;
}

/** Hero 가동 모드 — 절전/충전/주행/대기 단일 시그널 */
export function resolveVehicleOpsMode(
  snapshot: VehicleSnapshotDto | null | undefined,
): VehicleOpsMode {
  if (!snapshot) return "UNKNOWN";
  if (snapshot.status === "OFFLINE") return "OFFLINE";
  if (snapshot.status === "ASLEEP" || snapshot.isAsleepInferred) return "ASLEEP";
  if (snapshot.chargingStatus === "CHARGING") return "CHARGING";
  if (snapshot.shiftState && snapshot.shiftState !== "P") return "DRIVING";
  if (snapshot.status === "ONLINE" || snapshot.shiftState === "P") return "STANDBY";
  return "UNKNOWN";
}

export const OPS_MODE_LABEL: Record<VehicleOpsMode, string> = {
  DRIVING: "주행 중",
  CHARGING: "충전 중",
  STANDBY: "주차 · 대기",
  ASLEEP: "주차 (절전)",
  OFFLINE: "연결 끊김",
  UNKNOWN: "상태 확인 중",
};

export function opsModeBadgeColor(
  mode: VehicleOpsMode,
): "success" | "warning" | "error" | "info" | "light" {
  switch (mode) {
    case "DRIVING":
      return "success";
    case "CHARGING":
      return "info";
    case "STANDBY":
      return "light";
    case "ASLEEP":
      return "light";
    case "OFFLINE":
      return "error";
    default:
      return "light";
  }
}

export function isDrivingMode(mode: VehicleOpsMode): boolean {
  return mode === "DRIVING";
}

/** 룰 기반 관제 요약 (LLM 아님) */
export function buildOpsSummary(
  vehicle: VehicleDetailDto,
  provider: string,
): OpsSummaryItem[] {
  const snapshot = vehicle.snapshot;
  const items: OpsSummaryItem[] = [];
  const mode = resolveVehicleOpsMode(snapshot);

  if (!snapshot) {
    items.push({ tone: "warn", text: "실시간 스냅샷 없음 — 연동·신호를 확인하세요" });
    return items;
  }

  if (mode === "ASLEEP") {
    items.push({ tone: "ok", text: "주차(절전) — 마지막 신호 기준 관제" });
  } else if (mode === "CHARGING") {
    items.push({ tone: "info", text: "충전 중" });
  } else if (mode === "DRIVING") {
    const speed =
      snapshot.vehicleSpeedKmh != null
        ? ` · ${Math.round(snapshot.vehicleSpeedKmh)} km/h`
        : "";
    items.push({ tone: "info", text: `주행 중${speed}` });
  } else if (mode === "OFFLINE") {
    items.push({ tone: "warn", text: "연결 끊김" });
  } else {
    items.push({ tone: "ok", text: "주차 · 대기" });
  }

  if (snapshot.batteryPercent != null && snapshot.batteryPercent < 20) {
    items.push({
      tone: "warn",
      text: `배터리 ${snapshot.batteryPercent.toFixed(0)}% — 충전 권장`,
    });
  } else if (snapshot.batteryPercent != null) {
    items.push({
      tone: "ok",
      text: `배터리 ${snapshot.batteryPercent.toFixed(0)}%`,
    });
  }

  if (snapshot.locked === false) {
    items.push({ tone: "warn", text: "잠금 해제" });
  }
  if (snapshot.doorsOpen) items.push({ tone: "warn", text: "문 열림" });
  if (snapshot.windowsOpen) items.push({ tone: "warn", text: "창문 열림" });

  const tpmsCorners: Array<[string, number | null]> = [
    ["전좌", convertTeslaTpmsToPsi(snapshot.tpmsFrontLeft, provider)],
    ["전우", convertTeslaTpmsToPsi(snapshot.tpmsFrontRight, provider)],
    ["후좌", convertTeslaTpmsToPsi(snapshot.tpmsRearLeft, provider)],
    ["후우", convertTeslaTpmsToPsi(snapshot.tpmsRearRight, provider)],
  ];
  const lowTpms = tpmsCorners.filter(([, psi]) => isLowTpms(psi));
  if (snapshot.tpmsHardWarnings) {
    items.push({ tone: "warn", text: `타이어 Hard 경고: ${snapshot.tpmsHardWarnings}` });
  } else if (lowTpms.length > 0) {
    items.push({
      tone: "warn",
      text: `타이어 압력 이상 (${lowTpms.map(([l]) => l).join(", ")})`,
    });
  } else if (tpmsCorners.some(([, psi]) => psi != null)) {
    items.push({ tone: "ok", text: "타이어 압력 정상 범위" });
  }

  const sub = vehicle.telemetrySubscription;
  const hasSignal = Boolean(vehicle.freshness.lastTelemetryAt);
  if (sub?.active && !sub.configSynced && !hasSignal && !vehicle.syncState?.telemetryConfigSyncedAt) {
    items.push({
      tone: "warn",
      text: "실시간 신호 대기 — 필요 시 「연동 다시 켜기」",
    });
  }

  return items.slice(0, 6);
}

export function shouldShowDrivingTripCard(
  mode: VehicleOpsMode,
  snapshot: VehicleSnapshotDto | null | undefined,
): boolean {
  if (!isDrivingMode(mode) || !snapshot) return false;
  return Boolean(
    snapshot.destinationName ||
      snapshot.minutesToArrival != null ||
      snapshot.milesToArrival != null ||
      snapshot.expectedEnergyPercentAtArrival != null ||
      snapshot.vehicleSpeedKmh != null,
  );
}

export function formatChargeStatusLabel(
  status: ChargingStatus | null | undefined,
): string | null {
  if (!status || status === "DISCONNECTED") return null;
  return status;
}

export function vehicleStatusForDisplay(
  snapshot: VehicleSnapshotDto | null | undefined,
): VehicleStatus {
  if (!snapshot?.status) return "OFFLINE";
  if (snapshot.isAsleepInferred && snapshot.status !== "ASLEEP") return "ASLEEP";
  return snapshot.status;
}

/** VD3-NL — 인근 충전소 목록·맵 기호 (0→A … 4→E) */
export function nearbySiteLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

/** VD3-NL — siteType별 마커·목록 뱃지 색 */
export function nearbySiteTypeColor(
  siteType: "destination" | "supercharger" | null | undefined,
): string {
  if (siteType === "supercharger") return "#e82127";
  if (siteType === "destination") return "#0d9488";
  return "#71717a";
}

export function nearbySiteMarkerTitle(
  label: string,
  name: string,
  distanceKm: number | undefined,
): string {
  const distance =
    distanceKm != null ? ` · ${distanceKm.toLocaleString("ko-KR")} km` : "";
  return `${label} · ${name}${distance}`;
}

/** VD3-NL — 목록 보조 유형 뱃지 */
export function nearbySiteTypeBadgeLabel(
  siteType: "destination" | "supercharger" | null | undefined,
): "SC" | "DC" | null {
  if (siteType === "supercharger") return "SC";
  if (siteType === "destination") return "DC";
  return null;
}
