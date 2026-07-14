/**
 * LN-8: mergeSnapshotCoordinates 회귀 (TELEMETRY 좌표 → REST null → 유지)
 * Usage: node --import tsx scripts/verify-ln-rest-coordinates.mjs
 */
import { mergeSnapshotCoordinates } from "../src/lib/tesla/hybrid/coordinates.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const previous = { latitude: 37.5, longitude: 127.0 };

const kept = mergeSnapshotCoordinates(
  { latitude: null, longitude: null },
  previous,
);
assert(kept.latitude === 37.5 && kept.longitude === 127.0, "REST null → previous 유지");

const updated = mergeSnapshotCoordinates(
  { latitude: 37.6, longitude: 127.1 },
  previous,
);
assert(
  updated.latitude === 37.6 && updated.longitude === 127.1,
  "REST usable GPS → 갱신",
);

const empty = mergeSnapshotCoordinates({ latitude: null, longitude: null }, null);
assert(empty.latitude === null && empty.longitude === null, "previous 없음 → null");

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("LN-8 mergeSnapshotCoordinates OK");
