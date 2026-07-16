import {
  haversineKm,
  parseNearbyChargingJson,
} from "@/lib/tesla/nearby-charging";
import { normalizeShiftState } from "@/lib/tesla/shift-state";

export type ParkNearbyTrigger = "shift_edge" | "moved_then_p";

/** 이동 보완 트리거 거리(m). 0 이하면 비활성. 기본 300 */
export function getParkNearbyMoveMeters(): number {
  const meters = Number(process.env.TESLA_PARK_NEARBY_MOVE_METERS ?? "300");
  if (!Number.isFinite(meters) || meters < 0) return 300;
  return meters;
}

export function isDriveThenParkTransition(
  previousShiftState: string | null | undefined,
  currentShiftState: string | null | undefined,
): boolean {
  const current = normalizeShiftState(currentShiftState);
  if (current !== "P") return false;

  const previous = normalizeShiftState(previousShiftState);
  if (previous == null) return false;
  return previous !== "P";
}

/**
 * TRF-B2e: nearby REST 호출 여부.
 * 1) 비-P → P 엣지
 * 2) (옵션) 계속 P인데 마지막 nearby 좌표 대비 이동 ≥ threshold
 */
export function resolveParkNearbyTrigger(input: {
  previousShiftState: string | null | undefined;
  currentShiftState: string | null | undefined;
  currentLat: number | null | undefined;
  currentLng: number | null | undefined;
  nearbyChargingSitesJson: string | null | undefined;
}): ParkNearbyTrigger | null {
  if (
    isDriveThenParkTransition(input.previousShiftState, input.currentShiftState)
  ) {
    return "shift_edge";
  }

  const current = normalizeShiftState(input.currentShiftState);
  if (current !== "P") return null;

  const moveMeters = getParkNearbyMoveMeters();
  if (moveMeters <= 0) return null;

  const lat = input.currentLat;
  const lng = input.currentLng;
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  const parsed = parseNearbyChargingJson(input.nearbyChargingSitesJson ?? null);
  if (
    parsed.capturedLat == null ||
    parsed.capturedLng == null ||
    !Number.isFinite(parsed.capturedLat) ||
    !Number.isFinite(parsed.capturedLng)
  ) {
    return null;
  }

  const movedKm = haversineKm(
    parsed.capturedLat,
    parsed.capturedLng,
    lat,
    lng,
  );
  if (movedKm * 1000 >= moveMeters) {
    return "moved_then_p";
  }

  return null;
}
