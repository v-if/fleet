"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type {
  ActivitySessionListItem,
  VehicleActivitySummaryDto,
} from "@/lib/vehicle-activity-session";

type ActivityKindFilter = "all" | "drive" | "charge";

type ActivityResponse = {
  vehicleId: string;
  kind: ActivityKindFilter;
  items: ActivitySessionListItem[];
  from: string;
  to: string;
  limit: number;
  summary?: VehicleActivitySummaryDto;
  notice?: string;
};

async function fetchActivity(
  vehicleId: string,
  kind: ActivityKindFilter,
): Promise<ActivityResponse> {
  const params = new URLSearchParams({ kind });
  const response = await fetch(`/api/vehicles/${vehicleId}/activity?${params}`);
  if (!response.ok) {
    throw new Error("이력을 불러오지 못했습니다.");
  }
  return response.json();
}

function formatRange(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt);
  const fmt = (d: Date) =>
    d.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  if (!endedAt) {
    return `${fmt(start)} –`;
  }
  const end = new Date(endedAt);
  return `${fmt(start)} – ${fmt(end)}`;
}

function powerKindLabel(kind: string | null): string | null {
  if (kind === "AC") return "완속";
  if (kind === "DC") return "급속";
  return null;
}

function SessionRow({ item }: { item: ActivitySessionListItem }) {
  const isDrive = item.kind === "DRIVE";
  const title = isDrive ? "주행" : "충전";
  const detail = isDrive
    ? item.distanceKm != null
      ? `${item.distanceKm.toLocaleString("ko-KR")} km`
      : "거리 —"
    : [
        item.startBatteryPercent != null && item.endBatteryPercent != null
          ? `${Math.round(item.startBatteryPercent)}%→${Math.round(item.endBatteryPercent)}%`
          : null,
        item.energyAddedPercent != null
          ? `+${item.energyAddedPercent.toLocaleString("ko-KR")}%p`
          : null,
        powerKindLabel(item.chargingPowerKind),
      ]
        .filter(Boolean)
        .join(" · ") || "SoC —";

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-gray-100 py-2.5 last:border-0 dark:border-gray-800">
      <div className="min-w-0 flex flex-1 flex-wrap items-center gap-2">
        <span
          className={`inline-flex h-2 w-2 shrink-0 rounded-full ${
            isDrive ? "bg-brand-500" : "bg-success-500"
          }`}
          aria-hidden
        />
        <span className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
          {title}
        </span>
        {item.inProgress ? (
          <span className="rounded bg-warning-50 px-1.5 py-0.5 text-theme-xs font-medium text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
            진행 중
          </span>
        ) : null}
        <span className="text-theme-xs text-gray-500">
          {formatRange(item.startedAt, item.endedAt)}
        </span>
      </div>
      <span className="shrink-0 text-theme-sm text-gray-700 dark:text-gray-300">
        {detail}
      </span>
    </li>
  );
}

const FILTERS: { id: ActivityKindFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "drive", label: "주행" },
  { id: "charge", label: "충전" },
];

type VehicleActivityHistoryCardProps = {
  vehicleId: string;
};

export function VehicleActivityHistoryCard({
  vehicleId,
}: VehicleActivityHistoryCardProps) {
  const [kind, setKind] = useState<ActivityKindFilter>("all");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["vehicles", vehicleId, "activity", kind],
    queryFn: () => fetchActivity(vehicleId, kind),
    enabled: Boolean(vehicleId),
  });

  const count = data?.items.length ?? 0;
  const historyLine = data?.summary?.historyLine;

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          최근 이력
        </h4>
        <span className="text-theme-xs text-gray-500">
          최근 7일{count > 0 ? ` · ${count}건` : ""}
        </span>
      </div>
      {historyLine ? (
        <p className="mb-3 text-theme-sm text-gray-700 dark:text-gray-300">
          {historyLine}
        </p>
      ) : (
        <div className="mb-3" />
      )}

      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="이력 필터">
        {FILTERS.map((f) => {
          const active = kind === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKind(f.id)}
              className={`rounded-lg px-3 py-1.5 text-theme-sm font-medium transition ${
                active
                  ? "bg-gray-800 text-white dark:bg-white/90 dark:text-gray-900"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="py-4 text-theme-sm text-gray-400">불러오는 중…</p>
      ) : isError ? (
        <p className="py-4 text-theme-sm text-error-600">이력을 불러오지 못했습니다.</p>
      ) : count === 0 ? (
        <p className="py-4 text-theme-sm text-gray-400">
          최근 7일 이력이 없습니다.
        </p>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {data!.items.map((item) => (
            <SessionRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      <p className="mt-3 text-theme-xs text-gray-400">
        {data?.notice ??
          "Telemetry 기반 추정 이력입니다. 신호 공백 시 거리·충전량이 과소할 수 있습니다."}
      </p>
    </section>
  );
}
