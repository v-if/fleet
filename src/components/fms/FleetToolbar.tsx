"use client";

import Badge from "@/components/ui/badge/Badge";

type FleetToolbarProps = {
  title: string;
  description?: string;
  provider?: string;
  lastUpdatedAt?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export function FleetToolbar({
  title,
  description,
  provider,
  lastUpdatedAt,
  onRefresh,
  isRefreshing,
}: FleetToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">{title}</h2>
        {description ? (
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">{description}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {provider ? <Badge color="info">{provider}</Badge> : null}
          {lastUpdatedAt ? (
            <span className="text-theme-xs text-gray-400 dark:text-gray-500">
              갱신: {lastUpdatedAt}
            </span>
          ) : null}
        </div>
      </div>

      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
        >
          {isRefreshing ? "동기화 중..." : "새로고침"}
        </button>
      ) : null}
    </div>
  );
}
