/**
 * NCS: nearby catalog helpers
 * Usage: npm run ncs:verify
 */
import { ChargingStationSiteType } from "@prisma/client";
import {
  buildChargingStationGeoKey,
  getNearbyCatalogRadiusKm,
  isNearbyCatalogFallbackEnabled,
  normalizeStationNameKey,
} from "../src/lib/tesla/charging-station-catalog.ts";
import { extractNearbyCatalogSeeds } from "../src/lib/tesla/mapper.ts";
import {
  labelNearbyChargingSource,
  parseNearbyChargingJson,
  serializeNearbyChargingSites,
} from "../src/lib/tesla/nearby-charging.ts";

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed = true;
  } else {
    console.log("OK:", msg);
  }
}

assert(isNearbyCatalogFallbackEnabled() === true, "catalog fallback default ON");
assert(getNearbyCatalogRadiusKm() === 10, "default radius 10km");

const geo = buildChargingStationGeoKey(
  37.478402,
  126.886792,
  ChargingStationSiteType.supercharger,
);
assert(geo === "37.47840:126.88679:supercharger", `geoKey ${geo}`);
assert(normalizeStationNameKey("  Mario  Outlet ") === "mario outlet", "nameKey");

const seeds = extractNearbyCatalogSeeds(
  [
    {
      name: "Dest A",
      type: "destination",
      location: { lat: 37.48, long: 126.88 },
      distance_miles: 1,
    },
  ],
  [
    {
      name: "SC B",
      type: "supercharger",
      location: { lat: 37.481, long: 126.881 },
      available_stalls: 2,
      total_stalls: 4,
      site_closed: false,
    },
    {
      name: "No coords",
      type: "supercharger",
    },
  ],
);
assert(seeds.length === 2, `seeds length ${seeds.length}`);
assert(seeds[0].siteType === "destination", "dest type");
assert(seeds[1].totalStalls === 4, "stalls");

const json = serializeNearbyChargingSites([{ name: "X", distanceKm: 1.2 }], {
  source: "CATALOG",
  capturedLat: 1,
  capturedLng: 2,
});
const parsed = parseNearbyChargingJson(json);
assert(parsed.source === "CATALOG", "envelope source");
assert(labelNearbyChargingSource("CATALOG") === "저장된 충전소", "label catalog");
assert(labelNearbyChargingSource("TESLA_REST") === "Tesla 조회", "label rest");

if (failed) process.exit(1);
console.log("NCS verify OK");
