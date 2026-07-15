/**
 * TRF: Freeze default ON; Baseline graduated (exempt)
 * Usage: npm run trf:verify
 */
import {
  isRestFreezeEnabled,
  resolveVehicleSyncMode,
  REST_FREEZE_SKIP_ERROR,
  REST_FREEZE_GRADUATED_PATHS,
} from "../src/lib/tesla/telemetry/config.ts";

const prev = process.env.TESLA_REST_FREEZE;
let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed = true;
  } else {
    console.log("OK:", msg);
  }
}

delete process.env.TESLA_REST_FREEZE;
assert(isRestFreezeEnabled() === true, "default freeze ON");
assert(resolveVehicleSyncMode({ forceFallback: true }) === "registry", "fallback→registry under freeze");
assert(
  REST_FREEZE_GRADUATED_PATHS.includes("baseline_specs_only"),
  "baseline graduated from freeze",
);

process.env.TESLA_REST_FREEZE = "false";
assert(isRestFreezeEnabled() === false, "false disables freeze");

process.env.TESLA_REST_FREEZE = "true";
assert(isRestFreezeEnabled() === true, "true enables freeze");
assert(REST_FREEZE_SKIP_ERROR === "rest_freeze", "skip error token");

if (prev === undefined) delete process.env.TESLA_REST_FREEZE;
else process.env.TESLA_REST_FREEZE = prev;

if (failed) process.exit(1);
console.log("TRF freeze config OK (baseline graduated)");
