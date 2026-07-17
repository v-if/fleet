/**
 * VD3-SOH: 순수 규칙 (클라이언트·서버 공용, Prisma 없음)
 */

export const SOH_MIN_SAMPLES_FOR_CHART = 3;
export const SOH_OUTLIER_RATIO = 0.25;
export const SOH_LIMIT_TOLERANCE_PCT = 2;

export type SohSamplePoint = {
  sessionId: string;
  at: string;
  rangeKm: number;
  batteryPercent: number | null;
  chargeLimitSoc: number | null;
  outlier: boolean;
};

export type VehicleSohSummary = {
  samples: SohSamplePoint[];
  latest: SohSamplePoint | null;
  delta90dKm: number | null;
  delta90dPercent: number | null;
  chartReady: boolean;
  notice: string;
};

/** 한도 도달(또는 COMPLETE) + rangeKm 있으면 SOH 샘플 적격 */
export function evaluateSohSampleEligible(input: {
  endedAt: Date | null | undefined;
  endBatteryPercent: number | null | undefined;
  endRangeKm: number | null | undefined;
  endChargeLimitSoc: number | null | undefined;
  sawComplete?: boolean;
}): boolean {
  if (input.endedAt == null) return false;
  if (input.endRangeKm == null || !Number.isFinite(input.endRangeKm)) {
    return false;
  }
  const limit = input.endChargeLimitSoc ?? 100;
  const nearLimit =
    input.endBatteryPercent != null &&
    Number.isFinite(input.endBatteryPercent) &&
    input.endBatteryPercent >= limit - SOH_LIMIT_TOLERANCE_PCT;
  return nearLimit || input.sawComplete === true;
}

export function markSohOutliers(points: SohSamplePoint[]): SohSamplePoint[] {
  if (points.length === 0) return points;
  const sorted = [...points].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  return sorted.map((p, i) => {
    if (i === 0) return { ...p, outlier: false };
    const prev = sorted[i - 1];
    if (prev.rangeKm <= 0) return { ...p, outlier: false };
    const ratio = Math.abs(p.rangeKm - prev.rangeKm) / prev.rangeKm;
    return { ...p, outlier: ratio > SOH_OUTLIER_RATIO };
  });
}

export function computeSohDelta90d(samples: SohSamplePoint[]): {
  delta90dKm: number | null;
  delta90dPercent: number | null;
} {
  const usable = samples.filter((s) => !s.outlier);
  if (usable.length < 2) {
    return { delta90dKm: null, delta90dPercent: null };
  }
  const latest = usable[usable.length - 1];
  const latestAt = new Date(latest.at).getTime();
  const target = latestAt - 90 * 24 * 60 * 60 * 1000;
  let baseline = usable[0];
  for (const s of usable) {
    if (new Date(s.at).getTime() <= target) {
      baseline = s;
    }
  }
  if (baseline.sessionId === latest.sessionId) {
    return { delta90dKm: null, delta90dPercent: null };
  }
  const deltaKm = Math.round((latest.rangeKm - baseline.rangeKm) * 10) / 10;
  const deltaPct =
    baseline.rangeKm > 0
      ? Math.round((deltaKm / baseline.rangeKm) * 1000) / 10
      : null;
  return { delta90dKm: deltaKm, delta90dPercent: deltaPct };
}
