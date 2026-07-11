"use client";

import Link from "next/link";

import Badge from "@/components/ui/badge/Badge";
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
} from "@/lib/vehicle-status";
import {
  LIFECYCLE_LABEL,
  lifecycleBadgeColor,
  shouldShowLifecycleBadge,
} from "@/lib/vehicle-lifecycle";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

type FleetRecentVehiclesProps = {
  vehicles: VehicleListItemDto[];
  limit?: number;
};

const columns = [
  { label: "차량", className: "" },
  { label: "상태", className: "w-[92px] whitespace-nowrap px-3" },
  { label: "충전", className: "w-[108px] whitespace-nowrap px-3" },
  { label: "배터리", className: "w-[30%] min-w-[136px] max-w-[200px]" },
] as const;

export function FleetRecentVehicles({ vehicles, limit = 8 }: FleetRecentVehiclesProps) {
  const rows = vehicles.slice(0, limit);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">최근 차량</h3>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            플릿 전체 차량 상태 요약
          </p>
        </div>

        <Link
          href="/vehicles"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
        >
          전체 보기
        </Link>
      </div>

      <div className="max-w-full overflow-x-auto">
        <Table className="w-full table-fixed">
          <TableHeader className="border-y border-gray-100 dark:border-gray-800">
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.label}
                  isHeader
                  className={`px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400 ${col.className}`}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((vehicle) => {
              const snapshot = vehicle.snapshot;
              const status = snapshot?.status ?? "OFFLINE";
              const chargingStatus = snapshot?.chargingStatus ?? "DISCONNECTED";
              const lifecycle = vehicle.syncState?.lifecycle ?? null;

              return (
                <TableRow key={vehicle.id}>
                  <TableCell className="px-5 py-4">
                    <Link href={`/vehicles/${vehicle.id}`} className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                        <span className="font-semibold text-brand-500">
                          {vehicle.plateNumber.slice(0, 1)}
                        </span>
                      </div>
                      <div>
                        <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                          {vehicle.plateNumber}
                        </p>
                        <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                          {vehicle.model} · {vehicle.year}
                        </span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className={`py-4 ${columns[1].className}`}>
                    <div className="flex flex-col items-start gap-1">
                      <Badge size="sm" color={vehicleStatusBadgeColor(status)}>
                        {STATUS_LABEL[status]}
                      </Badge>
                      {shouldShowLifecycleBadge(lifecycle) && lifecycle ? (
                        <Badge size="sm" color={lifecycleBadgeColor(lifecycle)}>
                          {LIFECYCLE_LABEL[lifecycle]}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={`py-4 ${columns[2].className}`}>
                    <Badge size="sm" color={chargingStatusBadgeColor(chargingStatus)}>
                      {CHARGING_STATUS_LABEL[chargingStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className={`px-4 py-4 ${columns[3].className}`}>
                    <BatteryProgressBar percent={snapshot?.batteryPercent} expanded />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
          표시할 차량이 없습니다.
        </p>
      ) : null}

      <p className="mt-3 text-theme-xs text-gray-400 dark:text-gray-500">
        마지막 갱신: {formatDateTime(rows[0]?.snapshot?.lastUpdatedAt ?? null)}
      </p>
    </div>
  );
}
