import { TelemetryDisconnectReason } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { activeVehicleWhere } from "@/lib/vehicle-query";
import { disconnectVehicleTelemetry } from "@/lib/tesla/telemetry/disconnect";

async function countActiveVehiclesForAccount(teslaAccountId: string) {
  return prisma.vehicle.count({
    where: {
      teslaAccountId,
      ...activeVehicleWhere,
    },
  });
}

async function softUnlinkTeslaAccount(teslaAccountId: string) {
  const now = new Date();

  await prisma.teslaAccount.update({
    where: { id: teslaAccountId },
    data: {
      unlinkedAt: now,
      accessToken: "",
      refreshToken: "",
    },
  });
}

export type UnlinkVehicleResult = {
  vehicleId: string;
  accountUnlinked: boolean;
  telemetry: { ok: boolean; stub?: boolean; skipped?: boolean; error?: string };
};

/** B. 차량 플릿 제거 — 먼저 Telemetry 단절(A) 후 soft-delete */
export async function unlinkVehicle(vehicleId: string): Promise<UnlinkVehicleResult | null> {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      ...activeVehicleWhere,
    },
  });

  if (!vehicle) return null;

  const disconnect = await disconnectVehicleTelemetry(vehicleId, {
    reason: TelemetryDisconnectReason.UNLINK,
  });

  const now = new Date();

  await prisma.$transaction([
    prisma.vehicleSyncState.deleteMany({ where: { vehicleId: vehicle.id } }),
    prisma.telemetrySubscription.updateMany({
      where: { vehicleId: vehicle.id },
      data: {
        active: false,
        configSynced: false,
        configCheckedAt: null,
        unsubscribedAt: now,
        disconnectedAt: now,
        disconnectReason: TelemetryDisconnectReason.UNLINK,
      },
    }),
    prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        unlinkedAt: now,
        isDeleted: true,
      },
    }),
  ]);

  let accountUnlinked = false;

  if (vehicle.teslaAccountId) {
    const remaining = await countActiveVehiclesForAccount(vehicle.teslaAccountId);
    if (remaining === 0) {
      await softUnlinkTeslaAccount(vehicle.teslaAccountId);
      accountUnlinked = true;
    }
  }

  return {
    vehicleId: vehicle.id,
    accountUnlinked,
    telemetry: disconnect?.teslaUnsubscribe ?? { ok: false, error: "disconnect_failed" },
  };
}

export async function unlinkAllVehiclesForAccount(teslaAccountId: string) {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      teslaAccountId,
      ...activeVehicleWhere,
    },
  });

  for (const vehicle of vehicles) {
    await disconnectVehicleTelemetry(vehicle.id, {
      reason: TelemetryDisconnectReason.UNLINK,
    });
  }

  const now = new Date();
  const vehicleIds = vehicles.map((vehicle) => vehicle.id);

  await prisma.$transaction([
    prisma.vehicleSyncState.deleteMany({
      where: { vehicleId: { in: vehicleIds } },
    }),
    prisma.telemetrySubscription.updateMany({
      where: { vehicleId: { in: vehicleIds } },
      data: {
        active: false,
        configSynced: false,
        configCheckedAt: null,
        unsubscribedAt: now,
        disconnectedAt: now,
        disconnectReason: TelemetryDisconnectReason.UNLINK,
      },
    }),
    prisma.vehicle.updateMany({
      where: {
        teslaAccountId,
        ...activeVehicleWhere,
      },
      data: {
        unlinkedAt: now,
        isDeleted: true,
      },
    }),
  ]);

  await softUnlinkTeslaAccount(teslaAccountId);

  return { vehicleCount: vehicles.length };
}
