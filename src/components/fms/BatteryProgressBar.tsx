type BatteryProgressBarProps = {
  percent: number | null | undefined;
  className?: string;
  /** 대시보드 카드 등 넓은 영역 — 프로그래스바를 셀 폭에 맞게 확장 */
  expanded?: boolean;
};

function normalizePercent(percent: number | null | undefined) {
  if (percent == null || !Number.isFinite(percent)) return null;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function BatteryProgressBar({
  percent,
  className,
  expanded = false,
}: BatteryProgressBarProps) {
  const value = normalizePercent(percent);

  if (value == null) {
    return <span className="text-theme-sm text-gray-500 dark:text-gray-400">-</span>;
  }

  return (
    <div
      className={`flex items-center gap-3 ${
        expanded ? "w-full min-w-0" : "w-full max-w-[140px]"
      } ${className ?? ""}`}
    >
      <div
        className={`relative h-2.5 rounded-sm bg-gray-200 dark:bg-gray-800 ${
          expanded ? "min-w-0 flex-1" : "block w-full max-w-[100px]"
        }`}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-sm bg-brand-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="shrink-0 text-theme-sm font-medium text-gray-800 dark:text-white/90">
        {value}%
      </p>
    </div>
  );
}
