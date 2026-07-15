import type { VehicleLifecycle } from "@prisma/client";

import type { TailAdminBadgeColor } from "@/lib/fms-badge-utils";
import { labelCarType, labelTrimBadging } from "@/lib/tesla/display-model";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

export const LIFECYCLE_LABEL: Record<VehicleLifecycle, string> = {
  REGISTERED: "등록됨",
  KEY_PENDING: "키 연결 대기",
  TELEMETRY_PENDING: "실시간 연동 대기",
  READY: "관제 준비",
  TELEMETRY_DISCONNECTED: "실시간 연동 꺼짐",
};

export const DISCONNECT_REASON_LABEL: Record<
  "USER_SOFTWARE" | "VK_REMOVED_OFFLINE" | "UNLINK",
  string
> = {
  USER_SOFTWARE: "소프트웨어 해제",
  VK_REMOVED_OFFLINE: "차량 키 제거(추정)",
  UNLINK: "플릿 제거",
};

export const REST_SYNC_REASON_LABEL: Record<
  | "BASELINE"
  | "WAKE_COOLDOWN"
  | "MANUAL_FALLBACK"
  | "SPECS_REFRESH"
  | "PARK_NEARBY",
  string
> = {
  BASELINE: "제원 수집",
  WAKE_COOLDOWN: "기상 후 상세 조회(폐기)",
  MANUAL_FALLBACK: "수동 상세 조회",
  SPECS_REFRESH: "제원 다시 불러오기",
  PARK_NEARBY: "주차 후 인근충전소",
};

export function lifecycleBadgeColor(lifecycle: VehicleLifecycle): TailAdminBadgeColor {
  switch (lifecycle) {
    case "READY":
      return "success";
    case "TELEMETRY_PENDING":
      return "info";
    case "KEY_PENDING":
      return "warning";
    case "TELEMETRY_DISCONNECTED":
      return "warning";
    case "REGISTERED":
    default:
      return "light";
  }
}

/** READY는 목록에서 생략. 온보딩·단절 lifecycle 뱃지 표시 */
export function shouldShowLifecycleBadge(lifecycle: VehicleLifecycle | null | undefined) {
  return Boolean(lifecycle && lifecycle !== "READY");
}

export function lifecycleGuidance(lifecycle: VehicleLifecycle | null | undefined): {
  title: string;
  body: string;
  actions: Array<"confirm_key" | "retry_baseline" | "reconnect_telemetry">;
} | null {
  switch (lifecycle) {
    case "REGISTERED":
      return {
        title: "차량이 등록되었습니다",
        body: "차량 키 페어링 후 ‘키 연결 확인’을 진행하세요. 서버가 차량을 깨우지 않습니다.",
        actions: ["confirm_key"],
      };
    case "KEY_PENDING":
      return {
        title: "차량 키 연결이 필요합니다",
        body: "Tesla 앱에서 차량 키(Virtual Key) 페어링을 완료한 뒤 ‘키 연결 확인’을 눌러주세요.",
        actions: ["confirm_key"],
      };
    case "TELEMETRY_PENDING":
      return {
        title: "실시간 신호를 기다리는 중",
        body: "키가 확인되었습니다. 첫 실시간 신호를 기다리거나 「실시간 연동 다시 켜기」로 구독을 확인하세요. 제원만 비어 있으면 「제원 다시 불러오기」를 사용할 수 있습니다.",
        actions: ["reconnect_telemetry", "retry_baseline"],
      };
    case "TELEMETRY_DISCONNECTED":
      return {
        title: "실시간 연동이 꺼진 상태입니다",
        body: "실시간 수신이 중지되었습니다. 차량 키는 자동 삭제되지 않습니다. 다시 쓰려면 ‘실시간 연동 다시 켜기’를 진행하세요.",
        actions: ["reconnect_telemetry"],
      };
    case "READY":
      return null;
    default:
      return null;
  }
}

export function formatTrimBadge(vehicle: Pick<VehicleListItemDto, "trimBadging">) {
  return labelTrimBadging(vehicle.trimBadging);
}

export function formatColorBadge(vehicle: Pick<VehicleListItemDto, "exteriorColor">) {
  return vehicle.exteriorColor?.trim() || null;
}

export function formatSpecsModelLine(
  vehicle: Pick<VehicleListItemDto, "model" | "carType" | "year">,
) {
  const car = labelCarType(vehicle.carType);
  if (car && vehicle.model.includes(car)) {
    return `${vehicle.model} · ${vehicle.year}`;
  }
  return `${vehicle.model} · ${vehicle.year}`;
}
