/**
 * TRF-B1: extractVehicleSpecs Tier A/B/C from vehicle_data sample
 * Usage: npm run trf-b1:verify
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractVehicleSpecs,
  pickVehicleConfigJson,
  VEHICLE_CONFIG_JSON_KEYS,
} from "../src/lib/tesla/hybrid/vehicle-specs.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePath = join(
  __dirname,
  "../docs/fleet-api/endpoints/vehicle-endpoints/vehicle_data.json",
);

const sample = JSON.parse(readFileSync(samplePath, "utf8"));
const data = sample.response;

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed = true;
  } else {
    console.log("OK:", msg);
  }
}

const listItem = {
  id: data.id,
  vehicle_id: data.vehicle_id,
  vin: data.vin,
  display_name: data.display_name ?? null,
  state: data.state,
  id_s: data.id_s,
  access_type: data.access_type,
};

const specs = extractVehicleSpecs(listItem, data, {
  vin: data.vin,
  firmware_version: "fleet-fw-fallback",
});

assert(specs.carType === "modely", `carType=${specs.carType}`);
assert(specs.trimBadging === "74d", `trimBadging=${specs.trimBadging}`);
assert(specs.exteriorColor === "MidnightSilver", `exteriorColor=${specs.exteriorColor}`);
assert(specs.wheelType === "Apollo19", `wheelType=${specs.wheelType}`);
assert(specs.roofColor === "RoofColorGlass", `roofColor=${specs.roofColor}`);
assert(specs.chargePortType === "US", `chargePortType=${specs.chargePortType}`);
assert(specs.driverAssist === "TeslaAP3", `driverAssist=${specs.driverAssist}`);
assert(specs.exteriorTrim === "Black", `exteriorTrim=${specs.exteriorTrim}`);
assert(
  specs.firmwareVersion?.startsWith("2023.7.20"),
  `firmwareVersion=${specs.firmwareVersion}`,
);
assert(specs.teslaVehicleId === "100021", `teslaVehicleId=${specs.teslaVehicleId}`);
assert(specs.accessType === "OWNER", `accessType=${specs.accessType}`);
assert(specs.vehicleConfigJson != null, "vehicleConfigJson present");
assert(
  specs.vehicleConfigJson?.efficiency_package === "MY2021",
  "Tier C efficiency_package",
);
assert(
  specs.vehicleConfigJson?.has_air_suspension === false,
  "Tier C has_air_suspension",
);
assert(!("battery_level" in (specs.vehicleConfigJson ?? {})), "no charge_state leak");
assert(VEHICLE_CONFIG_JSON_KEYS.includes("utc_offset"), "utc_offset in whitelist");

const filtered = pickVehicleConfigJson({
  efficiency_package: "X",
  battery_level: 99,
  tokens: ["secret"],
});
assert(filtered?.efficiency_package === "X", "pick keeps whitelist");
assert(filtered && !("battery_level" in filtered), "pick drops dynamic");
assert(filtered && !("tokens" in filtered), "pick drops tokens");

if (failed) process.exit(1);
console.log("TRF-B1 specs extract OK");
