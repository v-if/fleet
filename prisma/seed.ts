import { prisma } from "../src/lib/prisma";
import { syncVehiclesFromProvider } from "../src/lib/vehicle-sync";

async function main() {
  const result = await syncVehiclesFromProvider();

  await prisma.user.upsert({
    where: { email: "admin@fleet.local" },
    update: { name: "Fleet Admin" },
    create: {
      email: "admin@fleet.local",
      name: "Fleet Admin",
    },
  });

  console.log(
    `Seeded ${result.vehicleCount} vehicles (${result.provider}${result.usedFallback ? ", fallback" : ""}).`,
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
