/**
 * CAF-2: default telemetry fields count / forbidden keys
 * Usage: npm run caf:verify
 */
import { getDefaultTelemetryFields } from "../src/lib/tesla/telemetry/default-fields.ts";

const fields = getDefaultTelemetryFields();
const keys = Object.keys(fields);
const forbidden = ["Version", "BatteryLevel", "RouteLastUpdated", "ShiftState", "CarType", "ExteriorColor", "Trim"];

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed = true;
  } else {
    console.log("OK:", msg);
  }
}

assert(keys.length === 44, `field count 44 (got ${keys.length})`);
assert(!keys.includes("Version"), "Version not subscribed (REST-1)");
for (const k of forbidden) {
  assert(!keys.includes(k), `forbidden key absent: ${k}`);
}
assert(keys.includes("VehicleSpeed") && keys.includes("GpsHeading"), "P1 speed/heading");
assert(keys.includes("DetailedChargeState") && keys.includes("TimeToFullCharge"), "P1 charging");
assert(keys.includes("DestinationName") && keys.includes("TpmsHardWarnings"), "P1 nav/tpms");

if (failed) process.exit(1);
console.log("CAF-2 getDefaultTelemetryFields OK");
