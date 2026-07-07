import { cn } from "@/lib/utils";

type BatteryHealthGaugeProps = {
  percent: number | null;
  rangeKm?: number | null;
};

export function BatteryHealthGauge({ percent, rangeKm }: BatteryHealthGaugeProps) {
  const value = percent != null ? Math.max(0, Math.min(100, percent)) : 0;
  const hasData = percent != null;

  const statusLabel =
    value >= 60 ? "양호" : value >= 30 ? "주의" : hasData ? "충전 필요" : "-";
  const statusColor =
    value >= 60 ? "text-emerald-600" : value >= 30 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-semibold tabular-nums">
            {hasData ? `${Math.round(value)}%` : "-"}
          </p>
          <p className={cn("text-sm font-medium", statusColor)}>{statusLabel}</p>
        </div>
        {rangeKm != null ? (
          <p className="text-sm text-muted-foreground">
            주행가능 <span className="font-medium text-foreground">{Math.round(rangeKm)} km</span>
          </p>
        ) : null}
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            value >= 60
              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
              : value >= 30
                ? "bg-gradient-to-r from-amber-500 to-amber-400"
                : "bg-gradient-to-r from-red-500 to-red-400",
          )}
          style={{ width: hasData ? `${value}%` : "0%" }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Mock 기준 잔량 표시 · SOH(배터리 건강)는 실 연동 후 제공
      </p>
    </div>
  );
}
