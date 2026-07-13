"use client";

import Link from "next/link";

import Badge from "@/components/ui/badge/Badge";
import { ArrowRightIcon } from "@/icons";
import {
  STATUS_LABEL,
  getAttentionReason,
  getIdleDurationLabel,
} from "@/lib/vehicle-status";
import { vehicleStatusBadgeColor } from "@/lib/fms-badge-utils";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

type FleetAttentionPanelProps = {
  vehicles: VehicleListItemDto[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function countAbnormal(vehicles: VehicleListItemDto[]) {
  let offline = 0;
  let asleep = 0;
  let warning = 0;
  let alert = 0;

  for (const vehicle of vehicles) {
    const status = vehicle.snapshot?.status;
    if (status === "OFFLINE") offline++;
    else if (status === "ASLEEP") asleep++;
    else if (status === "WARNING") warning++;
    else if (status === "ALERT") alert++;
  }

  return { offline, asleep, warning, alert };
}

export function FleetAttentionPanel({
  vehicles,
  selectedId,
  onSelect,
}: FleetAttentionPanelProps) {
  const counts = countAbnormal(vehicles);
  const abnormal = vehicles.filter((vehicle) => {
    const status = vehicle.snapshot?.status;
    return status === "OFFLINE" || status === "ASLEEP" || status === "WARNING" || status === "ALERT";
  });
  const idle = vehicles.filter((vehicle) => vehicle.isIdle).slice(0, 5);

  return (
    <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              이상 상태 차량
            </h3>
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              오프라인 {counts.offline} · 주차(절전) {counts.asleep} · 주의 {counts.warning} · 이상 {counts.alert}
            </p>
          </div>
          <Link
            href="/vehicles?filter=abnormal"
            className="inline-flex items-center gap-1 text-theme-sm text-brand-500 hover:text-brand-600"
          >
            더보기 <ArrowRightIcon className="size-4" />
          </Link>
        </div>

        <ul className="custom-scrollbar max-h-72 space-y-3 overflow-y-auto">
          {abnormal.slice(0, 6).map((vehicle) => {
            const status = vehicle.snapshot?.status ?? "OFFLINE";
            const active = selectedId === vehicle.id;

            return (
              <li key={vehicle.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(vehicle.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10"
                      : "border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <div>
                    <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                      {vehicle.plateNumber}
                    </p>
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {vehicle.model} · {getAttentionReason(vehicle)}
                    </p>
                  </div>
                  <Badge size="sm" color={vehicleStatusBadgeColor(status)}>
                    {STATUS_LABEL[status]}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>

        {abnormal.length === 0 ? (
          <p className="py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
            이상 상태 차량이 없습니다.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              미운행 차량
            </h3>
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              7일 이상 미운행 {vehicles.filter((v) => v.isIdle).length}대
            </p>
          </div>
          <Link
            href="/vehicles?filter=idle"
            className="inline-flex items-center gap-1 text-theme-sm text-brand-500 hover:text-brand-600"
          >
            더보기 <ArrowRightIcon className="size-4" />
          </Link>
        </div>

        <ul className="custom-scrollbar max-h-72 space-y-3 overflow-y-auto">
          {idle.map((vehicle) => {
            const active = selectedId === vehicle.id;

            return (
              <li key={vehicle.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(vehicle.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10"
                      : "border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <div>
                    <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                      {vehicle.plateNumber}
                    </p>
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {vehicle.model} · {getIdleDurationLabel(vehicle.snapshot?.lastUpdatedAt ?? null)}
                    </p>
                  </div>
                  <Badge size="sm" color="light">
                    미운행
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>

        {idle.length === 0 ? (
          <p className="py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
            미운행 차량이 없습니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}
