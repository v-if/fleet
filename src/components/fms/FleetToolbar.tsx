"use client";

import type { ReactNode } from "react";

import Badge from "@/components/ui/badge/Badge";

type FleetToolbarProps = {
  /** 생략 시 좌측 식별 블록 없음 (상세 VD3 — Hero가 SoT) */
  title?: string;
  description?: string;
  provider?: string;
  lastUpdatedAt?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: ReactNode;
  /**
   * `default` — 모바일에서 제목/액션 세로 분리 (`lg`부터 한 행)
   * `inline` — 모든 viewport에서 제목·새로고침 한 행 (차량상세 VD3-R)
   */
  layout?: "default" | "inline";
};

export function FleetToolbar({
  title,
  description,
  provider,
  lastUpdatedAt,
  onRefresh,
  isRefreshing,
  actions,
  layout = "default",
}: FleetToolbarProps) {
  const isInline = layout === "inline";
  const hasIdentity = Boolean(title || description || provider || lastUpdatedAt);
  const shellClass = isInline
    ? hasIdentity
      ? "mb-6 flex flex-row items-start justify-between gap-3"
      : "mb-6 flex flex-row items-center justify-end gap-3"
    : "mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between";
  const titleBlockClass = isInline ? "min-w-0 flex-1" : undefined;
  const titleClass = isInline
    ? "truncate text-xl font-semibold text-gray-800 dark:text-white/90"
    : "text-xl font-semibold text-gray-800 dark:text-white/90";
  const actionsClass = isInline
    ? "flex shrink-0 flex-wrap items-center gap-3"
    : "flex flex-wrap items-center gap-3";

  return (
    <div className={shellClass}>
      {hasIdentity ? (
        <div className={titleBlockClass}>
          {title ? (
            <h2 className={titleClass} title={title}>
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">{description}</p>
          ) : null}
          {(provider || lastUpdatedAt) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {provider ? <Badge color="info">{provider}</Badge> : null}
              {lastUpdatedAt ? (
                <span className="text-theme-xs text-gray-400 dark:text-gray-500">
                  갱신: {lastUpdatedAt}
                </span>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <div className={actionsClass}>
        {actions}
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
          >
            {isRefreshing ? "동기화 중..." : "새로고침"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
