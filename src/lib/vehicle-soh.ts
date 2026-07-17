/**
 * VD3-SOH: 충전 한도 도달 시 잔여 km 샘플 집계 (서버)
 */
import { prisma } from "@/lib/prisma";
import {
  SOH_MIN_SAMPLES_FOR_CHART,
  computeSohDelta90d,
  markSohOutliers,
  type SohSamplePoint,
  type VehicleSohSummary,
} from "@/lib/vehicle-soh-rules";

export type { SohSamplePoint, VehicleSohSummary };
export {
  SOH_MIN_SAMPLES_FOR_CHART,
  evaluateSohSampleEligible,
} from "@/lib/vehicle-soh-rules";

export async function getVehicleSohSummary(
  vehicleId: string,
  options?: { from?: Date; to?: Date },
): Promise<VehicleSohSummary> {
  const to = options?.to ?? new Date();
  const from =
    options?.from ?? new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

  const rows = await prisma.vehicleActivitySession.findMany({
    where: {
      vehicleId,
      kind: "CHARGE",
      sohSampleEligible: true,
      endedAt: { not: null, gte: from, lte: to },
      endRangeKm: { not: null },
    },
    orderBy: { endedAt: "asc" },
    take: 200,
  });

  const raw: SohSamplePoint[] = rows.map((r) => ({
    sessionId: r.id,
    at: (r.endedAt ?? r.startedAt).toISOString(),
    rangeKm: r.endRangeKm!,
    batteryPercent: r.endBatteryPercent,
    chargeLimitSoc: r.endChargeLimitSoc,
    outlier: false,
  }));

  const samples = markSohOutliers(raw);
  const { delta90dKm, delta90dPercent } = computeSohDelta90d(samples);
  const latest = samples.length > 0 ? samples[samples.length - 1] : null;

  return {
    samples,
    latest,
    delta90dKm,
    delta90dPercent,
    chartReady: samples.length >= SOH_MIN_SAMPLES_FOR_CHART,
    notice:
      "Telemetry 추정입니다. 충전 한도 도달 시 잔여 km 추이며 제조사 SOH와 다를 수 있습니다.",
  };
}
