import { prisma } from "../src/lib/prisma";
import { syncVehiclesFromProvider } from "../src/lib/vehicle-sync";

/**
 * Phase 3.9+: 데모용 admin@fleet.local 자동 생성 금지.
 * FMS User는 로그인용 auth.users + public."User"로만 관리한다.
 * Tesla OAuth / 차량 동기화는 세션 userId에 귀속된다.
 */
async function main() {
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
