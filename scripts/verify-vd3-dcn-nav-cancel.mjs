/**
 * VD3-DCn: 주행 중 안내 종료 — Destination* Invalid → Nav 클리어 · 속도 유지
 * Usage: npm run vd3-dcn:verify
 */
import {
  clearTripNavFieldsOnly,
  mergeCafSnapshotFields,
} from "../src/lib/tesla/telemetry/caf-fields.ts";
import { parseTelemetryMessage } from "../src/lib/tesla/telemetry/mapper.ts";

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed = true;
  } else {
    console.log("OK:", msg);
  }
}

const baseMsg = {
  vin: "TESTVINDCN000001",
  createdAt: new Date().toISOString(),
};

// 1) Invalid DestinationName → tripNavCleared
const clearedParse = parseTelemetryMessage({
  ...baseMsg,
  data: {
    DestinationName: { stringValue: "Invalid" },
    VehicleSpeed: { doubleValue: 40 },
  },
});
assert(clearedParse?.tripNavCleared === true, "Invalid DestinationName → tripNavCleared");
assert(clearedParse?.destinationName === null, "cleared destinationName null");
assert(clearedParse?.minutesToArrival === null, "cleared minutesToArrival null");
assert(clearedParse?.vehicleSpeedKmh != null, "speed still parsed from packet");

// 2) 키 없음 → destination 필드 omit · cleared 아님
const speedOnly = parseTelemetryMessage({
  ...baseMsg,
  data: {
    VehicleSpeed: { doubleValue: 35 },
  },
});
assert(speedOnly?.tripNavCleared !== true, "speed-only: no tripNavCleared");
assert(!("destinationName" in (speedOnly ?? {})), "speed-only: destinationName omitted");

// 3) 유효 목적지
const withDest = parseTelemetryMessage({
  ...baseMsg,
  data: {
    DestinationName: { stringValue: "집" },
    MinutesToArrival: { doubleValue: 12 },
    ExpectedEnergyPercentAtTripArrival: { doubleValue: 45 },
    VehicleSpeed: { doubleValue: 50 },
  },
});
assert(withDest?.tripNavCleared !== true, "valid dest: no cleared");
assert(withDest?.destinationName === "집", "valid destinationName");
assert(withDest?.minutesToArrival === 12, "valid minutesToArrival");

// 4) merge: cleared → Nav null · 속도 coalesce 유지
const previous = {
  destinationName: "회사",
  destinationLatitude: 37.5,
  destinationLongitude: 127.0,
  minutesToArrival: 20,
  expectedEnergyPercentAtArrival: 50,
  vehicleSpeedKmh: 48,
  gpsHeading: 90,
};
const mergedClear = mergeCafSnapshotFields(
  {
    tripNavCleared: true,
    destinationName: null,
    destinationLatitude: null,
    destinationLongitude: null,
    minutesToArrival: null,
    milesToArrival: null,
    expectedEnergyPercentAtArrival: null,
    vehicleSpeedKmh: 55,
  },
  previous,
);
assert(mergedClear.destinationName === null, "merge cleared: destinationName null");
assert(mergedClear.minutesToArrival === null, "merge cleared: minutes null");
assert(mergedClear.expectedEnergyPercentAtArrival === null, "merge cleared: energy null");
assert(mergedClear.vehicleSpeedKmh === 55, "merge cleared: speed from current");
assert(mergedClear.gpsHeading === 90, "merge cleared: heading coalesced");

// 5) merge: 키 없음(omit) → 이전 목적지 유지 (깜빡임 방지)
const mergedKeep = mergeCafSnapshotFields({ vehicleSpeedKmh: 60 }, previous);
assert(mergedKeep.destinationName === "회사", "omit dest: coalesce name");
assert(mergedKeep.minutesToArrival === 20, "omit dest: coalesce minutes");
assert(mergedKeep.vehicleSpeedKmh === 60, "omit dest: speed updates");

// 6) clearTripNavFieldsOnly — 속도 유지
const navOnly = clearTripNavFieldsOnly({
  destinationName: "집",
  minutesToArrival: 5,
  vehicleSpeedKmh: 33,
  gpsHeading: 10,
});
assert(navOnly.destinationName === null, "navOnly clears name");
assert(navOnly.vehicleSpeedKmh === 33, "navOnly keeps speed");
assert(navOnly.gpsHeading === 10, "navOnly keeps heading");

// 7) MinutesToArrival Invalid alone → suite clear
const minutesInvalid = parseTelemetryMessage({
  ...baseMsg,
  data: {
    MinutesToArrival: { stringValue: "Invalid" },
  },
});
assert(minutesInvalid?.tripNavCleared === true, "Invalid MinutesToArrival → cleared");

if (failed) process.exit(1);
console.log("VD3-DCn verify OK");
