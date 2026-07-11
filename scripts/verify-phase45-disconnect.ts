/**
 * Phase 4.5.D — Telemetry 소프트웨어 끊기 E2E + 정적 회귀
 * 실행: npx tsx --env-file=.env scripts/verify-phase45-disconnect.ts [VIN]
 * 기본 VIN: LRWYGCFJ7SC214742
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PrismaClient,
  TelemetryDisconnectReason,
  VehicleLifecycle,
} from "@prisma/client";

import {
  disconnectVehicleTelemetry,
  reconnectVehicleTelemetry,
} from "../src/lib/tesla/telemetry/disconnect";
import { maybeRunWakeCooldownRestSync } from "../src/lib/tesla/hybrid/rest-sync";

const targetVin = (process.argv[2] ?? "LRWYGCFJ7SC214742").toUpperCase();
const prisma = new PrismaClient();
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readSrc(relPath: string) {
  return readFileSync(join(root, relPath), "utf8");
}

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walkTsFiles(full, acc);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

function staticChecks() {
  const disconnectSrc = readSrc("src/lib/tesla/telemetry/disconnect.ts");
  const restSyncSrc = readSrc("src/lib/tesla/hybrid/rest-sync.ts");
  const processorSrc = readSrc("src/lib/tesla/telemetry/processor.ts");
  const statusSrc = readSrc("src/lib/tesla/telemetry/status.ts");

  assert(!/vehicle_data/.test(disconnectSrc), "disconnect.ts must not call vehicle_data");
  assert(!/wake_up/.test(disconnectSrc), "disconnect.ts must not call wake_up");
  assert(
    /TELEMETRY_DISCONNECTED/.test(restSyncSrc) && /telemetry_disconnected/.test(restSyncSrc),
    "rest-sync must skip TELEMETRY_DISCONNECTED",
  );
  assert(
    /TELEMETRY_DISCONNECTED/.test(processorSrc),
    "processor must guard TELEMETRY_DISCONNECTED",
  );
  assert(
    /telemetrySubscription:\s*\{\s*is:\s*\{\s*active:\s*true\s*\}\s*\}/.test(statusSrc),
    "status allowlist must require active subscription",
  );

  const wakeHits: string[] = [];
  for (const file of walkTsFiles(join(root, "src"))) {
    const text = readFileSync(file, "utf8");
    if (/wake_up/.test(text)) wakeHits.push(file.replace(root, ""));
  }
  assert(wakeHits.length === 0, `wake_up must not appear in src: ${wakeHits.join(", ")}`);

  return { ok: true as const };
}

async function loadVehicle(vin: string) {
  return prisma.vehicle.findFirst({
    where: {
      oemVehicleId: { equals: vin, mode: "insensitive" },
      isDeleted: false,
      unlinkedAt: null,
    },
    include: {
      telemetrySubscription: true,
      syncState: true,
      snapshots: {
        orderBy: { lastUpdatedAt: "desc" },
        take: 1,
        select: {
          status: true,
          isAsleepInferred: true,
          lastUpdatedAt: true,
        },
      },
    },
  });
}

async function main() {
  const staticResult = staticChecks();

  const before = await loadVehicle(targetVin);
  assert(before, `Vehicle not found for VIN ${targetVin} (active, not soft-deleted)`);
  assert(before.oemVehicleId, "oemVehicleId missing");

  const beforeSnapshot = before.snapshots[0] ?? null;
  const wasAsleep =
    beforeSnapshot?.status === "ASLEEP" || beforeSnapshot?.isAsleepInferred === true;

  if (wasAsleep && before.syncState?.lifecycle === VehicleLifecycle.TELEMETRY_DISCONNECTED) {
    assert(
      before.telemetrySubscription?.disconnectReason != null,
      "ASLEEP vehicle marked DISCONNECTED without disconnectReason (false positive)",
    );
  }

  let reconnectedFirst = false;
  if (
    before.syncState?.lifecycle === VehicleLifecycle.TELEMETRY_DISCONNECTED ||
    before.telemetrySubscription?.active === false
  ) {
    const reconnect = await reconnectVehicleTelemetry(before.id, {
      requestId: `phase45-d-reconnect-${Date.now()}`,
    });
    assert(reconnect?.ok, `reconnect failed: ${reconnect?.error ?? "null"}`);
    reconnectedFirst = true;
  }

  const disconnect = await disconnectVehicleTelemetry(before.id, {
    reason: TelemetryDisconnectReason.USER_SOFTWARE,
    requestId: `phase45-d-disconnect-${Date.now()}`,
  });
  assert(disconnect?.ok, `disconnect failed: ${disconnect?.error ?? "null"}`);

  const after = await loadVehicle(targetVin);
  assert(after, "Vehicle disappeared after disconnect (must remain in fleet list)");
  assert(after.isDeleted === false, "isDeleted must stay false (A ≠ unlink)");
  assert(after.unlinkedAt == null, "unlinkedAt must stay null");
  assert(
    after.syncState?.lifecycle === VehicleLifecycle.TELEMETRY_DISCONNECTED,
    `lifecycle expected TELEMETRY_DISCONNECTED, got ${after.syncState?.lifecycle}`,
  );
  assert(after.telemetrySubscription?.active === false, "subscription.active must be false");
  assert(
    after.telemetrySubscription?.disconnectReason === TelemetryDisconnectReason.USER_SOFTWARE,
    `disconnectReason expected USER_SOFTWARE, got ${after.telemetrySubscription?.disconnectReason}`,
  );
  assert(
    after.telemetrySubscription?.disconnectedAt != null,
    "disconnectedAt must be set",
  );

  const allowlisted = await prisma.vehicle.findMany({
    where: {
      isDeleted: false,
      unlinkedAt: null,
      oemVehicleId: { not: null },
      telemetrySubscription: { is: { active: true } },
    },
    select: { oemVehicleId: true },
  });
  const allowlistVins = allowlisted.map((v) => v.oemVehicleId?.toUpperCase());
  assert(
    !allowlistVins.includes(targetVin),
    "disconnected VIN must be excluded from status allowlist",
  );

  const asleepFalsePositives = await prisma.vehicleSnapshot.findMany({
    where: {
      OR: [{ status: "ASLEEP" }, { isAsleepInferred: true }],
      vehicle: {
        isDeleted: false,
        unlinkedAt: null,
        syncState: { lifecycle: VehicleLifecycle.TELEMETRY_DISCONNECTED },
        telemetrySubscription: { disconnectReason: null },
      },
    },
    select: { vehicleId: true },
    take: 5,
  });
  assert(
    asleepFalsePositives.length === 0,
    `ASLEEP false-positive DISCONNECTED: ${JSON.stringify(asleepFalsePositives)}`,
  );

  const wakeSkip = await maybeRunWakeCooldownRestSync(after.id);
  assert(wakeSkip.skipped === true, "wake cooldown REST must skip disconnected vehicle");
  assert(
    wakeSkip.error === "telemetry_disconnected",
    `wake skip reason expected telemetry_disconnected, got ${wakeSkip.error}`,
  );

  const audit = await prisma.auditLog.findFirst({
    where: { vehicleId: after.id, action: "TELEMETRY_DISCONNECT" },
    orderBy: { createdAt: "desc" },
    select: { status: true, summary: true, metadata: true, createdAt: true },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        vin: targetVin,
        vehicleId: after.id,
        plateNumber: after.plateNumber,
        reconnectedFirst,
        before: {
          lifecycle: before.syncState?.lifecycle ?? null,
          subscriptionActive: before.telemetrySubscription?.active ?? null,
          snapshotStatus: beforeSnapshot?.status ?? null,
          wasAsleep,
        },
        after: {
          lifecycle: after.syncState?.lifecycle,
          subscriptionActive: after.telemetrySubscription?.active,
          disconnectReason: after.telemetrySubscription?.disconnectReason,
          disconnectedAt: after.telemetrySubscription?.disconnectedAt,
          isDeleted: after.isDeleted,
          unlinkedAt: after.unlinkedAt,
        },
        teslaUnsubscribe: disconnect.teslaUnsubscribe,
        allowlistExcludesVin: true,
        allowlistActiveCount: allowlistVins.length,
        wakeRestSkipped: wakeSkip,
        asleepFalsePositives: 0,
        staticChecks: staticResult,
        latestAudit: audit,
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
