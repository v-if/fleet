/**
 * TRF-B2: Wake REST no-op · park nearby reason · gear removed
 * Usage: npm run trf-b2:verify
 */
import { RestSyncReason } from "@prisma/client";
import {
  maybeRunGearCorrectionRestSync,
  maybeRunWakeCooldownRestSync,
} from "../src/lib/tesla/hybrid/rest-sync.ts";
import {
  REST_FREEZE_GRADUATED_PATHS,
} from "../src/lib/tesla/telemetry/config.ts";
import { REST_SYNC_REASON_LABEL } from "../src/lib/vehicle-lifecycle.ts";

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed = true;
  } else {
    console.log("OK:", msg);
  }
}

assert(
  REST_FREEZE_GRADUATED_PATHS.includes("park_nearby"),
  "park_nearby in graduated paths",
);

assert(
  REST_SYNC_REASON_LABEL.PARK_NEARBY === "주차 후 인근충전소",
  "park nearby label",
);

const wake = await maybeRunWakeCooldownRestSync("verify-vehicle");
assert(wake.skipped === true && wake.error === "wake_no_rest", "wake REST no-op");

const gear = await maybeRunGearCorrectionRestSync("verify-vehicle");
assert(gear.skipped === true && gear.error === "gear_rest_removed", "gear REST removed");

assert(
  typeof RestSyncReason.PARK_NEARBY === "string" &&
    RestSyncReason.PARK_NEARBY === "PARK_NEARBY",
  "RestSyncReason.PARK_NEARBY enum",
);

if (failed) process.exit(1);
console.log("TRF-B2 verify OK");
