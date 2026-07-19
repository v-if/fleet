/**
 * VD3-H + VD3-HS: ActivitySession FSM · 오늘/미운행 집계
 * Usage: npm run vd3-h:verify
 */
import {
  buildHeroActivityLine,
  buildHistorySummaryLine,
  computeActivitySummaryFromSessions,
  formatDriveDurationKo,
  isChargeNoise,
  isDrivingObservation,
  isDriveNoise,
  isParkedOrAsleepObservation,
  planActivityTransitions,
} from "../src/lib/vehicle-activity-session.ts";
import {
  computeSohDelta90d,
  evaluateSohSampleEligible,
  markSohOutliers,
  SOH_MIN_SAMPLES_FOR_CHART,
} from "../src/lib/vehicle-soh-rules.ts";

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed = true;
  } else {
    console.log("OK:", msg);
  }
}

const t0 = new Date("2026-07-17T10:00:00+09:00");
const t1 = new Date("2026-07-17T10:30:00+09:00");
const tShort = new Date("2026-07-17T10:00:20+09:00");

assert(isDrivingObservation({ at: t0, shiftState: "D" }) === true, "D = driving");
assert(isDrivingObservation({ at: t0, shiftState: "P" }) === false, "P = not driving");
assert(isDrivingObservation({ at: t0, shiftState: "R" }) === true, "R = driving");
assert(
  isDrivingObservation({ at: t0, shiftState: "N", vehicleSpeedKmh: 10 }) === true,
  "N + speed = driving",
);
assert(isParkedOrAsleepObservation({ at: t0, shiftState: "P" }) === true, "P = parked");
assert(
  isParkedOrAsleepObservation({ at: t0, status: "ASLEEP", shiftState: "D" }) === true,
  "ASLEEP ends drive",
);

{
  const d = planActivityTransitions({
    open: { drive: null, charge: null },
    current: {
      at: t0,
      shiftState: "D",
      odometerKm: 1000,
      batteryPercent: 50,
    },
  });
  assert(d.length === 1 && d[0].type === "open_drive", "P→D opens drive");
}

{
  const openDrive = {
    id: "d1",
    vehicleId: "v1",
    kind: "DRIVE",
    startedAt: t0,
    endedAt: null,
    startOdometerKm: 1000,
    endOdometerKm: 1012,
    distanceKm: 12,
    startBatteryPercent: 50,
    endBatteryPercent: 45,
    energyAddedPercent: null,
    chargingPowerKind: null,
    peakChargerPowerKw: null,
    source: "TELEMETRY",
    createdAt: t0,
    updatedAt: t0,
  };
  const d = planActivityTransitions({
    open: { drive: openDrive, charge: null },
    current: {
      at: t1,
      shiftState: "P",
      odometerKm: 1012.4,
      batteryPercent: 44,
    },
  });
  assert(
    d.length === 1 && d[0].type === "close_drive" && d[0].discardNoise === false,
    "D→P closes drive (not noise)",
  );
}

assert(
  isDriveNoise({
    startedAt: t0,
    endedAt: tShort,
    distanceKm: 0.05,
  }) === true,
  "short drive is noise",
);
assert(
  isDriveNoise({
    startedAt: t0,
    endedAt: t1,
    distanceKm: 12,
  }) === false,
  "normal drive not noise",
);

{
  const d = planActivityTransitions({
    open: { drive: null, charge: null },
    current: {
      at: t0,
      shiftState: "P",
      chargingStatus: "CHARGING",
      batteryPercent: 40,
      chargingPowerKind: "AC",
      chargerPowerKw: 7,
    },
  });
  assert(d.length === 1 && d[0].type === "open_charge", "→CHARGING opens charge");
}

{
  const openCharge = {
    id: "c1",
    vehicleId: "v1",
    kind: "CHARGE",
    startedAt: t0,
    endedAt: null,
    startOdometerKm: null,
    endOdometerKm: null,
    distanceKm: null,
    startBatteryPercent: 40,
    endBatteryPercent: 70,
    energyAddedPercent: 30,
    chargingPowerKind: "AC",
    peakChargerPowerKw: 7,
    source: "TELEMETRY",
    createdAt: t0,
    updatedAt: t0,
  };
  const d = planActivityTransitions({
    open: { drive: null, charge: openCharge },
    current: {
      at: t1,
      shiftState: "P",
      chargingStatus: "COMPLETE",
      batteryPercent: 80,
    },
  });
  assert(
    d.length === 1 && d[0].type === "close_charge" && d[0].discardNoise === false,
    "COMPLETE closes charge (VD3-Hc)",
  );
}

{
  const openCharge = {
    id: "c1",
    vehicleId: "v1",
    kind: "CHARGE",
    startedAt: t0,
    endedAt: null,
    startOdometerKm: null,
    endOdometerKm: null,
    distanceKm: null,
    startBatteryPercent: 40,
    endBatteryPercent: 50,
    energyAddedPercent: 10,
    chargingPowerKind: "AC",
    peakChargerPowerKw: 7,
    source: "TELEMETRY",
    createdAt: t0,
    updatedAt: t0,
  };
  const d = planActivityTransitions({
    open: { drive: null, charge: openCharge },
    current: {
      at: t1,
      shiftState: "P",
      chargingStatus: "STOPPED",
      batteryPercent: 50,
    },
  });
  assert(d.length === 1 && d[0].type === "update_charge", "STOPPED updates charge");
}

{
  const d = planActivityTransitions({
    open: { drive: null, charge: null },
    current: {
      at: t1,
      shiftState: "P",
      chargingStatus: "COMPLETE",
      batteryPercent: 80,
    },
  });
  assert(d.length === 0, "COMPLETE without open charge is no-op");
}

{
  const openCharge = {
    id: "c1",
    vehicleId: "v1",
    kind: "CHARGE",
    startedAt: t0,
    endedAt: null,
    startOdometerKm: null,
    endOdometerKm: null,
    distanceKm: null,
    startBatteryPercent: 40,
    endBatteryPercent: 78,
    energyAddedPercent: 38,
    chargingPowerKind: "AC",
    peakChargerPowerKw: 7,
    source: "TELEMETRY",
    createdAt: t0,
    updatedAt: t0,
  };
  const d = planActivityTransitions({
    open: { drive: null, charge: openCharge },
    current: {
      at: t1,
      shiftState: "P",
      chargingStatus: "DISCONNECTED",
      batteryPercent: 78,
    },
  });
  assert(
    d.length === 1 && d[0].type === "close_charge" && d[0].discardNoise === false,
    "DISCONNECTED closes charge",
  );
}

assert(
  isChargeNoise({
    startedAt: t0,
    endedAt: new Date(t0.getTime() + 60_000),
    energyAddedPercent: 0.2,
  }) === true,
  "tiny charge is noise",
);

// —— VD3-HS ——
assert(formatDriveDurationKo(80 * 60_000) === "1시간 20분", "duration 1h20m");
assert(formatDriveDurationKo(45 * 60_000) === "45분", "duration 45m");

const now = new Date("2026-07-18T15:00:00+09:00");
const todayDrive = {
  kind: "DRIVE",
  startedAt: new Date("2026-07-18T10:00:00+09:00"),
  endedAt: new Date("2026-07-18T11:20:00+09:00"),
  distanceKm: 18.2,
};
const todayCharge = {
  kind: "CHARGE",
  startedAt: new Date("2026-07-18T12:00:00+09:00"),
  endedAt: new Date("2026-07-18T13:00:00+09:00"),
  distanceKm: null,
};
const oldDrive = {
  kind: "DRIVE",
  startedAt: new Date("2026-07-14T10:00:00+09:00"),
  endedAt: new Date("2026-07-14T11:00:00+09:00"),
  distanceKm: 5,
};

{
  const s = computeActivitySummaryFromSessions([todayDrive, todayCharge], now);
  assert(s.hasTodayDrive === true, "HS today has drive");
  assert(s.todayDistanceKm === 18.2, "HS today distance");
  assert(s.todayChargeCount === 1, "HS today charge count");
  assert(s.idleDays === 0, "HS idle 0 when drove today");
  const line = buildHistorySummaryLine(s);
  assert(
    line.includes("18.2") && line.includes("충전 1회"),
    `HS history line: ${line}`,
  );
  const hero = buildHeroActivityLine(s);
  assert(
    hero.text?.includes("18.2") && hero.tone === "info",
    `HS hero drive: ${hero.text}`,
  );
}

{
  const s = computeActivitySummaryFromSessions([oldDrive], now);
  assert(s.hasTodayDrive === false, "HS idle no today drive");
  assert(s.idleDays === 4, `HS idle days (got ${s.idleDays})`);
  const hero = buildHeroActivityLine(s);
  assert(
    hero.text === "미운행 4일" && hero.tone === "warn",
    `HS hero idle: ${hero.text}`,
  );
}

{
  const s = computeActivitySummaryFromSessions([], now);
  assert(s.idleDays === null, "HS no history idle null");
  assert(buildHeroActivityLine(s).text === null, "HS hero omit when no history");
}

// —— VD3-SOH ——
assert(
  evaluateSohSampleEligible({
    endedAt: now,
    endBatteryPercent: 80,
    endRangeKm: 400,
    endChargeLimitSoc: 80,
  }) === true,
  "SOH eligible near limit",
);
assert(
  evaluateSohSampleEligible({
    endedAt: now,
    endBatteryPercent: 70,
    endRangeKm: 350,
    endChargeLimitSoc: 80,
  }) === false,
  "SOH not eligible below limit",
);
assert(
  evaluateSohSampleEligible({
    endedAt: now,
    endBatteryPercent: 70,
    endRangeKm: 350,
    endChargeLimitSoc: 80,
    sawComplete: true,
  }) === true,
  "SOH eligible via COMPLETE",
);
assert(
  evaluateSohSampleEligible({
    endedAt: now,
    endBatteryPercent: 80,
    endRangeKm: null,
    endChargeLimitSoc: 80,
  }) === false,
  "SOH needs rangeKm",
);

{
  const pts = markSohOutliers([
    {
      sessionId: "a",
      at: "2026-01-01T00:00:00.000Z",
      rangeKm: 400,
      batteryPercent: 80,
      chargeLimitSoc: 80,
      outlier: false,
    },
    {
      sessionId: "b",
      at: "2026-02-01T00:00:00.000Z",
      rangeKm: 395,
      batteryPercent: 80,
      chargeLimitSoc: 80,
      outlier: false,
    },
    {
      sessionId: "c",
      at: "2026-03-01T00:00:00.000Z",
      rangeKm: 100,
      batteryPercent: 80,
      chargeLimitSoc: 80,
      outlier: false,
    },
  ]);
  assert(pts[2].outlier === true, "SOH outlier ±25%");
  assert(SOH_MIN_SAMPLES_FOR_CHART === 3, "SOH min samples");
  const delta = computeSohDelta90d(
    markSohOutliers([
      {
        sessionId: "a",
        at: "2026-01-01T00:00:00.000Z",
        rangeKm: 410,
        batteryPercent: 80,
        chargeLimitSoc: 80,
        outlier: false,
      },
      {
        sessionId: "b",
        at: "2026-04-01T00:00:00.000Z",
        rangeKm: 398,
        batteryPercent: 80,
        chargeLimitSoc: 80,
        outlier: false,
      },
    ]),
  );
  assert(delta.delta90dKm === -12, `SOH delta (got ${delta.delta90dKm})`);
}

if (failed) process.exit(1);
console.log("VD3-H / VD3-HS / VD3-SOH verify OK");
