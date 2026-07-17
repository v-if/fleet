"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import Badge from "@/components/ui/badge/Badge";
import Input from "@/components/form/input/InputField";
import { BatteryProgressBar } from "@/components/fms/BatteryProgressBar";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { vehicleStatusBadgeColor } from "@/lib/fms-badge-utils";
import {
  OPS_MODE_LABEL,
  opsModeBadgeColor,
  resolveVehicleOpsMode,
  type VehicleOpsMode,
} from "@/lib/vehicle-detail-v3";
import {
  STATUS_LABEL,
  formatDateTime,
  formatOdometer,
  formatRelativeTime,
} from "@/lib/vehicle-status";
import {
  LIFECYCLE_LABEL,
  formatColorBadge,
  lifecycleBadgeColor,
  shouldShowLifecycleBadge,
} from "@/lib/vehicle-lifecycle";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

/** VL-F — UI pill + 숨은 딥링크 값(idle) */
type StatusFilter =
  | "ALL"
  | "DRIVING"
  | "CHARGING"
  | "PARKED"
  | "WARNING"
  | "ISSUE"
  | "IDLE";

type FleetVehicleTableProps = {
  vehicles: VehicleListItemDto[];
  initialFilter?: StatusFilter;
  pageSize?: number;
};

const filterOptions: { value: Exclude<StatusFilter, "IDLE">; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "DRIVING", label: "운행 중" },
  { value: "CHARGING", label: "충전 중" },
  { value: "PARKED", label: "주차" },
  { value: "WARNING", label: "주의" },
  { value: "ISSUE", label: "이상" },
];

const tableColumns = [
  { label: "차량", className: "w-[180px]" },
  { label: "가동", className: "w-[110px] whitespace-nowrap" },
  { label: "충전", className: "w-[72px] whitespace-nowrap" },
  { label: "배터리", className: "w-[140px]" },
  { label: "총 주행거리", className: "w-[100px] whitespace-nowrap" },
  { label: "갱신", className: "w-[100px] whitespace-nowrap" },
] as const;

/** 대시보드 `?filter=` → VL-F 필터 (idle은 pill 없이 유지) */
function resolveInitialFilter(param: string | null): StatusFilter {
  if (param === "charging") return "CHARGING";
  if (param === "abnormal") return "ISSUE";
  if (param === "telemetry_disconnected") return "ISSUE";
  if (param === "idle") return "IDLE";
  if (param === "driving") return "DRIVING";
  if (param === "parked") return "PARKED";
  if (param === "warning") return "WARNING";
  if (param === "issue") return "ISSUE";
  return "ALL";
}

function rowFreshnessAt(vehicle: VehicleListItemDto): string | null {
  return (
    vehicle.freshness.lastTelemetryAt ??
    vehicle.snapshot?.lastUpdatedAt ??
    null
  );
}

function matchesListFilter(
  vehicle: VehicleListItemDto,
  statusFilter: StatusFilter,
): boolean {
  const snapshot = vehicle.snapshot;
  const mode: VehicleOpsMode = resolveVehicleOpsMode(snapshot);
  const status = snapshot?.status;
  const lifecycle = vehicle.syncState?.lifecycle;

  switch (statusFilter) {
    case "ALL":
      return true;
    case "DRIVING":
      return mode === "DRIVING";
    case "CHARGING":
      return snapshot?.chargingStatus === "CHARGING";
    case "PARKED":
      return mode === "STANDBY" || mode === "ASLEEP";
    case "WARNING":
      return status === "WARNING";
    case "ISSUE":
      return (
        status === "ALERT" ||
        status === "OFFLINE" ||
        lifecycle === "TELEMETRY_DISCONNECTED"
      );
    case "IDLE":
      return vehicle.isIdle;
    default:
      return true;
  }
}

export function FleetVehicleTable({
  vehicles,
  initialFilter = "ALL",
  pageSize = 10,
}: FleetVehicleTableProps) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    resolveInitialFilter(searchParams.get("filter")) || initialFilter,
  );
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const haystack =
        `${vehicle.plateNumber} ${vehicle.model} ${vehicle.carType ?? ""} ${vehicle.trimBadging ?? ""} ${vehicle.exteriorColor ?? ""}`.toLowerCase();
      const matchesQuery = haystack.includes(query.trim().toLowerCase());
      if (!matchesQuery) return false;
      return matchesListFilter(vehicle, statusFilter);
    });
  }, [query, statusFilter, vehicles]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Input
            type="text"
            placeholder="차량 식별명 또는 모델 검색"
            defaultValue={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                title={
                  option.value === "PARKED"
                    ? "주차 · 대기 및 주차 (절전) 포함"
                    : undefined
                }
                onClick={() => {
                  setStatusFilter(option.value);
                  setPage(1);
                }}
                className={`rounded-full border px-3 py-1.5 text-theme-sm transition-colors ${
                  statusFilter === option.value
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader className="border-b border-gray-100 dark:border-gray-800">
              <TableRow>
                {tableColumns.map((col) => (
                  <TableCell
                    key={col.label}
                    isHeader
                    className={`px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400 ${col.className}`}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paged.map((vehicle) => {
                const snapshot = vehicle.snapshot;
                const status = snapshot?.status ?? "OFFLINE";
                const mode = resolveVehicleOpsMode(snapshot);
                const lifecycle = vehicle.syncState?.lifecycle ?? null;
                const colorLabel = formatColorBadge(vehicle);
                const freshAt = rowFreshnessAt(vehicle);
                const isCharging = snapshot?.chargingStatus === "CHARGING";
                const showHealthBadge =
                  (status === "WARNING" || status === "ALERT") &&
                  mode !== "OFFLINE";
                const subtitle = colorLabel
                  ? `${vehicle.model} · ${colorLabel}`
                  : vehicle.model;

                return (
                  <TableRow key={vehicle.id}>
                    <TableCell className={`px-4 py-4 ${tableColumns[0].className}`}>
                      <Link href={`/vehicles/${vehicle.id}`} className="block min-w-0">
                        <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                          {vehicle.plateNumber}
                        </p>
                        <span className="mt-0.5 block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                          {subtitle}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className={`px-3 py-4 ${tableColumns[1].className}`}>
                      <div className="flex flex-col items-start gap-1">
                        <Badge size="sm" color={opsModeBadgeColor(mode)}>
                          {OPS_MODE_LABEL[mode]}
                        </Badge>
                        {showHealthBadge ? (
                          <Badge size="sm" color={vehicleStatusBadgeColor(status)}>
                            {STATUS_LABEL[status]}
                          </Badge>
                        ) : null}
                        {shouldShowLifecycleBadge(lifecycle) && lifecycle ? (
                          <Badge size="sm" color={lifecycleBadgeColor(lifecycle)}>
                            {LIFECYCLE_LABEL[lifecycle]}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className={`px-3 py-4 ${tableColumns[2].className}`}>
                      {isCharging ? (
                        <Badge size="sm" color="info">
                          충전 중
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className={`px-3 py-4 ${tableColumns[3].className}`}>
                      <div className="space-y-1">
                        <BatteryProgressBar percent={snapshot?.batteryPercent} expanded />
                        {snapshot?.rangeKm != null ? (
                          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                            잔여 {Math.round(snapshot.rangeKm).toLocaleString("ko-KR")} km
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`px-3 py-4 text-theme-sm text-gray-500 dark:text-gray-400 ${tableColumns[4].className}`}
                    >
                      {formatOdometer(snapshot?.odometerKm)}
                    </TableCell>
                    <TableCell
                      className={`px-3 py-4 text-theme-sm text-gray-500 dark:text-gray-400 ${tableColumns[5].className}`}
                    >
                      <span title={freshAt ? formatDateTime(freshAt) : undefined}>
                        {formatRelativeTime(freshAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {paged.length === 0 ? (
          <p className="py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400">
            조건에 맞는 차량이 없습니다.
          </p>
        ) : null}

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {filtered.length}대 중 {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filtered.length)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-theme-sm disabled:opacity-50 dark:border-gray-700"
            >
              이전
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-theme-sm disabled:opacity-50 dark:border-gray-700"
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
