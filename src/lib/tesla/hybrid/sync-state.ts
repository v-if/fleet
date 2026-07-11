import { RestSyncReason, VehicleLifecycle, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function ensureVehicleSyncState(vehicleId: string) {
  await prisma.vehicleSyncState.upsert({
    where: { vehicleId },
    create: { vehicleId },
    update: {},
  });
}

export type SyncStatePatch = {
  lifecycle?: VehicleLifecycle;
  virtualKeyConfirmedAt?: Date | null;
  telemetryConfigSyncedAt?: Date | null;
  baselineCompletedAt?: Date | null;
  baselineLastError?: string | null;
  lastRestSyncAt?: Date | null;
  lastRestSyncReason?: RestSyncReason | null;
  lastWakeDetectedAt?: Date | null;
};

export async function patchVehicleSyncState(vehicleId: string, patch: SyncStatePatch) {
  const data: Prisma.VehicleSyncStateUpdateInput = {};
  if (patch.lifecycle !== undefined) data.lifecycle = patch.lifecycle;
  if (patch.virtualKeyConfirmedAt !== undefined) {
    data.virtualKeyConfirmedAt = patch.virtualKeyConfirmedAt;
  }
  if (patch.telemetryConfigSyncedAt !== undefined) {
    data.telemetryConfigSyncedAt = patch.telemetryConfigSyncedAt;
  }
  if (patch.baselineCompletedAt !== undefined) {
    data.baselineCompletedAt = patch.baselineCompletedAt;
  }
  if (patch.baselineLastError !== undefined) {
    data.baselineLastError = patch.baselineLastError;
  }
  if (patch.lastRestSyncAt !== undefined) data.lastRestSyncAt = patch.lastRestSyncAt;
  if (patch.lastRestSyncReason !== undefined) {
    data.lastRestSyncReason = patch.lastRestSyncReason;
  }
  if (patch.lastWakeDetectedAt !== undefined) {
    data.lastWakeDetectedAt = patch.lastWakeDetectedAt;
  }

  await prisma.vehicleSyncState.upsert({
    where: { vehicleId },
    create: {
      vehicleId,
      lifecycle: patch.lifecycle ?? VehicleLifecycle.REGISTERED,
      virtualKeyConfirmedAt: patch.virtualKeyConfirmedAt ?? undefined,
      telemetryConfigSyncedAt: patch.telemetryConfigSyncedAt ?? undefined,
      baselineCompletedAt: patch.baselineCompletedAt ?? undefined,
      baselineLastError: patch.baselineLastError ?? undefined,
      lastRestSyncAt: patch.lastRestSyncAt ?? undefined,
      lastRestSyncReason: patch.lastRestSyncReason ?? undefined,
      lastWakeDetectedAt: patch.lastWakeDetectedAt ?? undefined,
    },
    update: data,
  });
}

/** READY는 유지. 그 외만 registry 힌트로 승격/설정 */
export async function applyRegistryLifecycleHint(
  vehicleId: string,
  vin: string | undefined,
  keyPairedVins: Set<string>,
  unpairedVins: Set<string>,
) {
  if (!vin) {
    await ensureVehicleSyncState(vehicleId);
    return;
  }

  const existing = await prisma.vehicleSyncState.findUnique({
    where: { vehicleId },
  });

  if (existing?.lifecycle === VehicleLifecycle.READY) {
    return;
  }
  if (existing?.lifecycle === VehicleLifecycle.TELEMETRY_DISCONNECTED) {
    return;
  }

  const normalized = vin.trim().toUpperCase();
  const paired = [...keyPairedVins].some((v) => v.toUpperCase() === normalized);
  const unpaired = [...unpairedVins].some((v) => v.toUpperCase() === normalized);

  if (unpaired) {
    await patchVehicleSyncState(vehicleId, {
      lifecycle: VehicleLifecycle.KEY_PENDING,
    });
    return;
  }

  if (paired) {
    await patchVehicleSyncState(vehicleId, {
      lifecycle: VehicleLifecycle.TELEMETRY_PENDING,
      virtualKeyConfirmedAt: existing?.virtualKeyConfirmedAt ?? new Date(),
    });
    return;
  }

  await patchVehicleSyncState(vehicleId, {
    lifecycle: existing?.lifecycle ?? VehicleLifecycle.REGISTERED,
  });
}

export function isRestWakeCooldownElapsed(
  lastRestSyncAt: Date | null | undefined,
  cooldownMinutes: number,
  now = new Date(),
): boolean {
  if (!lastRestSyncAt) return true;
  if (!Number.isFinite(cooldownMinutes) || cooldownMinutes <= 0) return true;
  return now.getTime() - lastRestSyncAt.getTime() >= cooldownMinutes * 60_000;
}
