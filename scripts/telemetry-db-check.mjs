import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const targetVin = process.argv[2] ?? "LRWYGCFJ7SC214742";

try {
  const vehicles = await prisma.vehicle.findMany({
    where: { isDeleted: false, unlinkedAt: null, oemVehicleId: { not: null } },
    select: {
      id: true,
      plateNumber: true,
      oemVehicleId: true,
      snapshots: {
        orderBy: { lastUpdatedAt: "desc" },
        take: 1,
        select: {
          telemetrySource: true,
          lastTelemetryAt: true,
          batteryPercent: true,
          lastUpdatedAt: true,
        },
      },
    },
  });

  const match = vehicles.find(
    (v) => v.oemVehicleId?.toUpperCase() === targetVin.toUpperCase(),
  );

  console.log(
    JSON.stringify(
      {
        targetVin,
        registeredCount: vehicles.length,
        targetMatched: Boolean(match),
        targetVehicle: match ?? null,
        vehicles: vehicles.map((v) => ({
          plateNumber: v.plateNumber,
          vin: v.oemVehicleId,
          telemetrySource: v.snapshots[0]?.telemetrySource ?? null,
          lastTelemetryAt: v.snapshots[0]?.lastTelemetryAt ?? null,
          lastUpdatedAt: v.snapshots[0]?.lastUpdatedAt ?? null,
          batteryPercent: v.snapshots[0]?.batteryPercent ?? null,
        })),
      },
      null,
      2,
    ),
  );

  const recent = await prisma.telemetryIngress.findMany({
    orderBy: { receivedAt: "desc" },
    take: 8,
    select: {
      vin: true,
      status: true,
      receivedAt: true,
      errorMessage: true,
    },
  });
  console.log("\nrecentIngress:\n", JSON.stringify(recent, null, 2));

  const meta = await prisma.telemetryMetadata.findUnique({ where: { id: "default" } });
  console.log("\nmetadata:\n", JSON.stringify(meta, null, 2));
} finally {
  await prisma.$disconnect();
}
