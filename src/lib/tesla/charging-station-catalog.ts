import { ChargingStationSiteType, ChargingStationSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/tesla/nearby-charging";
import type { NearbyChargingSite } from "@/lib/vehicle-providers/types";

export type NearbyCatalogSeed = {
  name: string;
  siteType: ChargingStationSiteType;
  latitude: number;
  longitude: number;
  totalStalls: number | null;
  lastAvailableStalls: number | null;
  siteClosed: boolean | null;
};

export function getNearbyCatalogRadiusKm(): number {
  const km = Number(process.env.TESLA_NEARBY_CATALOG_RADIUS_KM ?? "10");
  if (!Number.isFinite(km) || km <= 0) return 10;
  return km;
}

/** 기본 ON. false/0 이면 REST 실패 시 카탈로그 폴백 안 함 */
export function isNearbyCatalogFallbackEnabled(): boolean {
  const value = process.env.TESLA_NEARBY_CATALOG_FALLBACK?.trim();
  if (value === "false" || value === "0") return false;
  return true;
}

export function normalizeStationNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildChargingStationGeoKey(
  latitude: number,
  longitude: number,
  siteType: ChargingStationSiteType,
): string {
  const lat = latitude.toFixed(5);
  const lng = longitude.toFixed(5);
  return `${lat}:${lng}:${siteType}`;
}

export async function upsertChargingStationsFromSeeds(
  seeds: NearbyCatalogSeed[],
): Promise<{ upserted: number }> {
  if (seeds.length === 0) return { upserted: 0 };

  const now = new Date();
  let upserted = 0;

  for (const seed of seeds) {
    const geoKey = buildChargingStationGeoKey(
      seed.latitude,
      seed.longitude,
      seed.siteType,
    );
    const nameKey = normalizeStationNameKey(seed.name);

    await prisma.chargingStation.upsert({
      where: { geoKey },
      create: {
        source: ChargingStationSource.TESLA_NEARBY,
        siteType: seed.siteType,
        name: seed.name,
        nameKey,
        latitude: seed.latitude,
        longitude: seed.longitude,
        geoKey,
        totalStalls: seed.totalStalls,
        lastAvailableStalls: seed.lastAvailableStalls,
        siteClosed: seed.siteClosed,
        lastSeenAt: now,
        hitCount: 1,
      },
      update: {
        name: seed.name,
        nameKey,
        latitude: seed.latitude,
        longitude: seed.longitude,
        totalStalls: seed.totalStalls ?? undefined,
        lastAvailableStalls: seed.lastAvailableStalls ?? undefined,
        siteClosed: seed.siteClosed ?? undefined,
        lastSeenAt: now,
        hitCount: { increment: 1 },
      },
    });
    upserted += 1;
  }

  return { upserted };
}

/**
 * 차량 좌표 반경 내 카탈로그 → UI nearby 목록 (거리순 · limit).
 * bbox로 후보를 줄인 뒤 haversine 필터.
 */
export async function queryNearbyFromCatalog(
  latitude: number,
  longitude: number,
  options: { radiusKm?: number; limit?: number } = {},
): Promise<NearbyChargingSite[]> {
  const radiusKm = options.radiusKm ?? getNearbyCatalogRadiusKm();
  const limit = options.limit ?? 8;
  const deg = radiusKm / 111;

  const candidates = await prisma.chargingStation.findMany({
    where: {
      siteClosed: { not: true },
      latitude: { gte: latitude - deg, lte: latitude + deg },
      longitude: { gte: longitude - deg, lte: longitude + deg },
    },
    take: 200,
  });

  return candidates
    .map((row) => {
      const distanceKm = haversineKm(
        latitude,
        longitude,
        row.latitude,
        row.longitude,
      );
      return {
        name: row.name,
        distanceKm: Math.round(distanceKm * 10) / 10,
        latitude: row.latitude,
        longitude: row.longitude,
        siteType:
          row.siteType === "supercharger" ? ("supercharger" as const) : ("destination" as const),
        _distance: distanceKm,
      };
    })
    .filter((s) => s._distance <= radiusKm)
    .sort((a, b) => a._distance - b._distance)
    .slice(0, limit)
    .map(({ name, distanceKm, latitude: lat, longitude: lng, siteType }) => ({
      name,
      distanceKm,
      latitude: lat,
      longitude: lng,
      siteType,
    }));
}
