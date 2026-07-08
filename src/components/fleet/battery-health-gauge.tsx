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
    value >= 60
      ? "text-success-600 dark:text-success-500"
      : value >= 30
        ? "text-warning-600 dark:text-warning-500"
        : "text-error-600 dark:text-error-500";

  const gaugeColor =
    value >= 60 ? "#12b76a" : value >= 30 ? "#f79009" : "#f04438";

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative size-36 shrink-0">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: hasData
              ? `conic-gradient(${gaugeColor} ${value * 3.6}deg, var(--color-gray-100) 0deg)`
              : "var(--color-gray-100)",
          }}
        />
        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-card">
          <p className="text-title-sm font-bold tabular-nums">
            {hasData ? `${Math.round(value)}%` : "-"}
          </p>
          <p className={cn("text-theme-xs font-medium", statusColor)}>{statusLabel}</p>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        {rangeKm != null ? (
          <p className="text-theme-sm text-muted-foreground">
            주행가능{" "}
            <span className="font-semibold text-foreground">{Math.round(rangeKm)} km</span>
          </p>
        ) : null}
        <div className="relative h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: hasData ? `${value}%` : "0%",
              backgroundColor: gaugeColor,
            }}
          />
        </div>
        <p className="text-theme-xs text-muted-foreground">
          Mock 기준 잔량 표시 · SOH(배터리 건강)는 실 연동 후 제공
        </p>
      </div>
    </div>
  );
}
