import type { NearbyChargingSite } from "@/lib/vehicle-providers/types";
import type { NearbyChargingSiteDto } from "@/lib/types/vehicle";

export type NearbyChargingEnvelope = {
  sites: NearbyChargingSite[];
  capturedAt: string;
  capturedLat: number | null;
  capturedLng: number | null;
};

export type NearbyChargingParsed = {
  sites: NearbyChargingSiteDto[];
  capturedAt: string | null;
  capturedLat: number | null;
  capturedLng: number | null;
};

/** 인근 충전소 stale 클리어 거리(km). 기본 2 */
export function getNearbyStaleDistanceKm(): number {
  const km = Number(process.env.TESLA_NEARBY_STALE_DISTANCE_KM ?? "2");
  if (!Number.isFinite(km) || km <= 0) return 2;
  return km;
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function serializeNearbyChargingSites(
  sites: NearbyChargingSite[],
  meta: {
    capturedAt?: Date;
    capturedLat?: number | null;
    capturedLng?: number | null;
  } = {},
): string {
  const envelope: NearbyChargingEnvelope = {
    sites,
    capturedAt: (meta.capturedAt ?? new Date()).toISOString(),
    capturedLat: meta.capturedLat ?? null,
    capturedLng: meta.capturedLng ?? null,
  };
  return JSON.stringify(envelope);
}

export function parseNearbyChargingJson(json: string | null): NearbyChargingParsed {
  if (!json) {
    return { sites: [], capturedAt: null, capturedLat: null, capturedLng: null };
  }
  try {
    const parsed = JSON.parse(json) as
      | NearbyChargingEnvelope
      | NearbyChargingSiteDto[];

    if (Array.isArray(parsed)) {
      return {
        sites: parsed.filter(
          (s): s is NearbyChargingSiteDto =>
            Boolean(s && typeof s.name === "string"),
        ),
        capturedAt: null,
        capturedLat: null,
        capturedLng: null,
      };
    }

    if (parsed && typeof parsed === "object" && Array.isArray(parsed.sites)) {
      return {
        sites: parsed.sites.filter(
          (s): s is NearbyChargingSiteDto =>
            Boolean(s && typeof s.name === "string"),
        ),
        capturedAt:
          typeof parsed.capturedAt === "string" ? parsed.capturedAt : null,
        capturedLat:
          typeof parsed.capturedLat === "number" ? parsed.capturedLat : null,
        capturedLng:
          typeof parsed.capturedLng === "number" ? parsed.capturedLng : null,
      };
    }
  } catch {
    /* ignore */
  }
  return { sites: [], capturedAt: null, capturedLat: null, capturedLng: null };
}

/** GPS가 수집 지점에서 임계 초과면 클리어 대상 */
export function shouldClearNearbyForLocation(
  nearbyJson: string | null,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  thresholdKm = getNearbyStaleDistanceKm(),
): boolean {
  if (
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return false;
  }
  const parsed = parseNearbyChargingJson(nearbyJson);
  if (parsed.sites.length === 0) return false;

  const originLat = parsed.capturedLat;
  const originLng = parsed.capturedLng;
  if (originLat == null || originLng == null) {
    // 메타 없는 구형 데이터: 클리어하지 않음(다음 REST에서 메타 부여)
    return false;
  }

  return haversineKm(originLat, originLng, latitude, longitude) > thresholdKm;
}
