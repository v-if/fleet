import { getOrCreateDefaultUser } from "../src/lib/fms-user";
import { prisma } from "../src/lib/prisma";
import { syncVehiclesFromProvider } from "../src/lib/vehicle-sync";

async function main() {
  await getOrCreateDefaultUser();
  const result = await syncVehiclesFromProvider();

  console.log(
    `Seeded ${result.vehicleCount} active vehicles (${result.provider}${result.usedFallback ? ", fallback" : ""}).`,
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
