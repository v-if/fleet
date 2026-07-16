/**
 * TRF-B2 + B2e: Wake REST no-op · park nearby reason · drive→P edge
 * Usage: npm run trf-b2:verify
 */
import { RestSyncReason } from "@prisma/client";
import {
  maybeRunGearCorrectionRestSync,
  maybeRunWakeCooldownRestSync,
} from "../src/lib/tesla/hybrid/rest-sync.ts";
import {
  isDriveThenParkTransition,
  resolveParkNearbyTrigger,
} from "../src/lib/tesla/park-nearby-trigger.ts";
import { clearTripDestinationFields } from "../src/lib/tesla/telemetry/caf-fields.ts";
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

assert(isDriveThenParkTransition("D", "P") === true, "edge D→P");
assert(isDriveThenParkTransition("R", "P") === true, "edge R→P");
assert(isDriveThenParkTransition("N", "P") === true, "edge N→P");
assert(isDriveThenParkTransition("P", "P") === false, "no edge P→P (reboard)");
assert(isDriveThenParkTransition(null, "P") === false, "no edge null→P");
assert(isDriveThenParkTransition("D", "D") === false, "no edge D→D");

assert(
  resolveParkNearbyTrigger({
    previousShiftState: "D",
    currentShiftState: "P",
    currentLat: 37.5,
    currentLng: 127.0,
    nearbyChargingSitesJson: null,
  }) === "shift_edge",
  "resolve shift_edge",
);

assert(
  resolveParkNearbyTrigger({
    previousShiftState: "P",
    currentShiftState: "P",
    currentLat: 37.5,
    currentLng: 127.0,
    nearbyChargingSitesJson: null,
  }) === null,
  "resolve skip reboard P without move meta",
);

const movedJson = JSON.stringify({
  sites: [],
  capturedAt: new Date().toISOString(),
  capturedLat: 37.5,
  capturedLng: 127.0,
  source: "TESLA_REST",
});
assert(
  resolveParkNearbyTrigger({
    previousShiftState: "P",
    currentShiftState: "P",
    // ~0.5km north ≈ enough for 300m default
    currentLat: 37.5045,
    currentLng: 127.0,
    nearbyChargingSitesJson: movedJson,
  }) === "moved_then_p",
  "resolve moved_then_p",
);

const cleared = clearTripDestinationFields({
  destinationName: "집",
  destinationLatitude: 37.5,
  destinationLongitude: 127.0,
  minutesToArrival: 10,
  milesToArrival: 5,
  expectedEnergyPercentAtArrival: 40,
  vehicleSpeedKmh: 30,
});
assert(cleared.destinationName === null, "VD3-DC clear destinationName");
assert(cleared.destinationLatitude === null, "VD3-DC clear destinationLatitude");
assert(cleared.minutesToArrival === null, "VD3-DC clear minutesToArrival");
assert(cleared.expectedEnergyPercentAtArrival === null, "VD3-DC clear expectedEnergy");
assert(cleared.vehicleSpeedKmh === 30, "VD3-DC keep vehicleSpeedKmh");

if (failed) process.exit(1);
console.log("TRF-B2 / B2e / VD3-DC verify OK");
