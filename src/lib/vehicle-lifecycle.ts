import type { VehicleLifecycle } from "@prisma/client";

import type { TailAdminBadgeColor } from "@/lib/fms-badge-utils";
import { labelCarType, labelTrimBadging } from "@/lib/tesla/display-model";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

export const LIFECYCLE_LABEL: Record<VehicleLifecycle, string> = {
  REGISTERED: "등록됨",
  KEY_PENDING: "키 연결 대기",
  TELEMETRY_PENDING: "Telemetry 대기",
  READY: "관제 준비",
  TELEMETRY_DISCONNECTED: "Telemetry 단절",
};

export const DISCONNECT_REASON_LABEL: Record<
  "USER_SOFTWARE" | "VK_REMOVED_OFFLINE" | "UNLINK",
  string
> = {
  USER_SOFTWARE: "소프트웨어 해제",
  VK_REMOVED_OFFLINE: "가상키 제거(추정)",
  UNLINK: "플릿 제거",
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
        body: "Virtual Key 페어링 후 ‘키 연결 확인’을 진행하세요. 차량을 서버에서 깨우지 않습니다.",
        actions: ["confirm_key"],
      };
    case "KEY_PENDING":
      return {
        title: "Virtual Key 연결이 필요합니다",
        body: "Tesla 앱에서 Virtual Key QR/페어링을 완료한 뒤 ‘키 연결 확인’을 눌러주세요.",
        actions: ["confirm_key"],
      };
    case "TELEMETRY_PENDING":
      return {
        title: "Telemetry 수신을 기다리는 중",
        body: "키가 확인되었습니다. Telemetry 설정 동기화 또는 첫 수신을 기다리거나, 차량이 깨어 있을 때 Baseline을 재시도할 수 있습니다.",
        actions: ["retry_baseline"],
      };
    case "TELEMETRY_DISCONNECTED":
      return {
        title: "Telemetry 연동이 해제된 상태입니다",
        body: "실시간 수신이 중지되었습니다. Virtual Key는 자동 삭제되지 않습니다. 다시 쓰려면 ‘Telemetry 다시 연결’을 진행하세요.",
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
