import { prisma } from "@/lib/prisma";
import { activeVehicleWhere } from "@/lib/vehicle-query";
import { unsubscribeVehicleTelemetry } from "@/lib/tesla/telemetry/subscription";

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

export async function unlinkVehicle(vehicleId: string): Promise<UnlinkVehicleResult | null> {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      ...activeVehicleWhere,
    },
  });

  if (!vehicle) return null;

  const telemetry = await unsubscribeVehicleTelemetry(vehicle.oemVehicleId, {
    vehicleId: vehicle.id,
    teslaAccountId: vehicle.teslaAccountId,
  });
  const now = new Date();

  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: {
      unlinkedAt: now,
      isDeleted: true,
    },
  });

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
    telemetry,
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
    await unsubscribeVehicleTelemetry(vehicle.oemVehicleId, {
      vehicleId: vehicle.id,
      teslaAccountId,
    });
  }

  const now = new Date();

  await prisma.vehicle.updateMany({
    where: {
      teslaAccountId,
      ...activeVehicleWhere,
    },
    data: {
      unlinkedAt: now,
      isDeleted: true,
    },
  });

  await softUnlinkTeslaAccount(teslaAccountId);

  return { vehicleCount: vehicles.length };
}
