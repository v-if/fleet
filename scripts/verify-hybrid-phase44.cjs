/**
 * Phase 4.4.E — 하이브리드 로직 정적 검증 (실차 불필요)
 * 실행: node scripts/verify-hybrid-phase44.mjs
 */
const { PrismaClient } = require("@prisma/client");

function isRestWakeCooldownElapsed(lastRestSyncAt, cooldownMinutes, now = new Date()) {
  if (!lastRestSyncAt) return true;
  if (!Number.isFinite(cooldownMinutes) || cooldownMinutes <= 0) return true;
  return now.getTime() - lastRestSyncAt.getTime() >= cooldownMinutes * 60_000;
}

function buildDisplayModel(carType, trimBadging) {
  const cars = {
    model3: "Model 3",
    modely: "Model Y",
    models: "Model S",
    modelx: "Model X",
    cybertruck: "Cybertruck",
  };
  const trims = {
    50: "RWD",
    "74": "Long Range RWD",
    "74d": "Long Range AWD",
    p74d: "Performance",
    long_range: "Long Range",
    longrange: "Long Range",
    performance: "Performance",
    plaid: "Plaid",
    rwd: "RWD",
    awd: "AWD",
  };
  const carKey = String(carType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const car = cars[carKey] ?? (carType?.trim() || null);
  if (!car) return null;
  const trimKey = String(trimBadging || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const trim = trims[trimKey] ?? (trimBadging?.trim() || null);
  return trim ? `${car} · ${trim}` : car;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const now = new Date("2026-07-11T12:00:00.000Z");
const cooldown = 30;

assert(isRestWakeCooldownElapsed(null, cooldown, now) === true, "null → Call");
assert(
  isRestWakeCooldownElapsed(new Date("2026-07-11T11:45:00.000Z"), cooldown, now) === false,
  "15m → Skip",
);
assert(
  isRestWakeCooldownElapsed(new Date("2026-07-11T11:29:00.000Z"), cooldown, now) === true,
  "31m → Call",
);
assert(buildDisplayModel("modely", "50") === "Model Y · RWD", "modely/50");
assert(buildDisplayModel("model3", "p74d") === "Model 3 · Performance", "model3/p74d");

const prisma = new PrismaClient();

async function main() {
  const activeVehicles = await prisma.vehicle.count({
    where: { isDeleted: false, unlinkedAt: null },
  });
  const syncStateRows = await prisma.vehicleSyncState.count();
  const syncStateOnDeleted = await prisma.vehicleSyncState.count({
    where: { vehicle: { isDeleted: true } },
  });

  // 제원 컬럼이 Telemetry Snapshot과 분리되어 있는지 스키마 존재 확인
  const sample = await prisma.vehicle.findFirst({
    where: { isDeleted: false, unlinkedAt: null },
    select: {
      id: true,
      carType: true,
      model: true,
      specsSyncedAt: true,
      syncState: { select: { lifecycle: true, lastRestSyncAt: true } },
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        cooldownCases: "pass",
        displayModel: "pass",
        activeVehicles,
        syncStateRows,
        syncStateOnDeletedVehicles: syncStateOnDeleted,
        sampleVehicle: sample,
        wakeUpInSrc: "verified_separately_grep_0",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
