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
import {
  chargingStatusBadgeColor,
  vehicleStatusBadgeColor,
} from "@/lib/fms-badge-utils";
import {
  CHARGING_STATUS_LABEL,
  STATUS_LABEL,
  formatDateTime,
  formatOdometer,
} from "@/lib/vehicle-status";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

type StatusFilter = "ALL" | "ONLINE" | "WARNING" | "ALERT" | "OFFLINE" | "ASLEEP" | "IDLE" | "CHARGING" | "ABNORMAL";

type FleetVehicleTableProps = {
  vehicles: VehicleListItemDto[];
  initialFilter?: StatusFilter;
  pageSize?: number;
};

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "ONLINE", label: "정상" },
  { value: "CHARGING", label: "충전중" },
  { value: "WARNING", label: "주의" },
  { value: "ALERT", label: "이상" },
  { value: "ABNORMAL", label: "이상상태" },
  { value: "OFFLINE", label: "오프라인" },
  { value: "ASLEEP", label: "취침 중" },
  { value: "IDLE", label: "미운행" },
];

const tableColumns = [
  { label: "차량", className: "w-[200px]" },
  { label: "상태", className: "w-[72px] whitespace-nowrap" },
  { label: "충전", className: "w-[84px] whitespace-nowrap" },
  { label: "배터리", className: "w-[140px]" },
  { label: "주행거리", className: "w-[92px] whitespace-nowrap" },
  { label: "갱신", className: "w-[124px] whitespace-nowrap" },
] as const;

function resolveInitialFilter(param: string | null): StatusFilter {
  if (param === "abnormal") return "ABNORMAL";
  if (param === "idle") return "IDLE";
  if (param === "charging") return "CHARGING";
  return "ALL";
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
      const snapshot = vehicle.snapshot;
      const haystack = `${vehicle.plateNumber} ${vehicle.model}`.toLowerCase();
      const matchesQuery = haystack.includes(query.trim().toLowerCase());

      if (!matchesQuery) return false;
      if (statusFilter === "ALL") return true;
      if (statusFilter === "IDLE") return vehicle.isIdle;
      if (statusFilter === "CHARGING") return snapshot?.chargingStatus === "CHARGING";
      if (statusFilter === "ABNORMAL") {
        const status = snapshot?.status;
        return status === "OFFLINE" || status === "ASLEEP" || status === "WARNING" || status === "ALERT";
      }
      return snapshot?.status === statusFilter;
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
                const chargingStatus = snapshot?.chargingStatus ?? "DISCONNECTED";

                return (
                  <TableRow key={vehicle.id}>
                    <TableCell className={`px-4 py-4 ${tableColumns[0].className}`}>
                      <Link
                        href={`/vehicles/${vehicle.id}`}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                          <span className="font-semibold text-brand-500">
                            {vehicle.plateNumber.slice(0, 1)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                            {vehicle.plateNumber}
                          </p>
                          <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                            {vehicle.model} · {vehicle.year}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className={`px-3 py-4 ${tableColumns[1].className}`}>
                      <Badge size="sm" color={vehicleStatusBadgeColor(status)}>
                        {STATUS_LABEL[status]}
                      </Badge>
                    </TableCell>
                    <TableCell className={`px-3 py-4 ${tableColumns[2].className}`}>
                      <Badge size="sm" color={chargingStatusBadgeColor(chargingStatus)}>
                        {CHARGING_STATUS_LABEL[chargingStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className={`px-3 py-4 ${tableColumns[3].className}`}>
                      <BatteryProgressBar percent={snapshot?.batteryPercent} expanded />
                    </TableCell>
                    <TableCell
                      className={`px-3 py-4 text-theme-sm text-gray-500 dark:text-gray-400 ${tableColumns[4].className}`}
                    >
                      {formatOdometer(snapshot?.odometerKm)}
                    </TableCell>
                    <TableCell
                      className={`px-3 py-4 text-theme-sm text-gray-500 dark:text-gray-400 ${tableColumns[5].className}`}
                    >
                      {formatDateTime(snapshot?.lastUpdatedAt ?? null)}
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
