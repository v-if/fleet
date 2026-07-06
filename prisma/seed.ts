import { prisma } from "../src/lib/prisma";
import {
  createVehicleProvider,
  getMockVehicleEvents,
} from "../src/lib/vehicle-providers";

async function main() {
  const provider = createVehicleProvider();
  const vehicles = await provider.fetchVehicles();

  for (const snapshot of vehicles) {
    const vehicle = await prisma.vehicle.upsert({
      where: { plateNumber: snapshot.plateNumber },
      update: {
        model: snapshot.model,
        year: snapshot.year,
        oemVehicleId: snapshot.oemVehicleId,
      },
      create: {
        plateNumber: snapshot.plateNumber,
        model: snapshot.model,
        year: snapshot.year,
        oemVehicleId: snapshot.oemVehicleId,
      },
    });

    await prisma.vehicleSnapshot.create({
      data: {
        vehicleId: vehicle.id,
        latitude: snapshot.latitude,
        longitude: snapshot.longitude,
        batteryPercent: snapshot.batteryPercent,
        rangeKm: snapshot.rangeKm,
        ignitionOn: snapshot.ignitionOn,
        status: snapshot.status,
        lastUpdatedAt: snapshot.lastUpdatedAt,
      },
    });
  }

  for (const event of getMockVehicleEvents()) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: event.plateNumber },
    });

    if (!vehicle) continue;

    await prisma.vehicleEvent.create({
      data: {
        vehicleId: vehicle.id,
        type: event.type,
        message: event.message,
        occurredAt: event.occurredAt,
      },
    });
  }

  await prisma.user.upsert({
    where: { email: "admin@fleet.local" },
    update: { name: "Fleet Admin" },
    create: {
      email: "admin@fleet.local",
      name: "Fleet Admin",
    },
  });

  console.log(`Seeded ${vehicles.length} vehicles.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
