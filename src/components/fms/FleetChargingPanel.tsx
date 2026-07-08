"use client";

import Link from "next/link";

import Badge from "@/components/ui/badge/Badge";
import { BatteryProgressBar } from "@/components/fms/BatteryProgressBar";
import { BoltIcon } from "@/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { chargingStatusBadgeColor } from "@/lib/fms-badge-utils";
import { CHARGING_STATUS_LABEL } from "@/lib/vehicle-status";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

type FleetChargingPanelProps = {
  vehicles: VehicleListItemDto[];
};

const colVehicle = "min-w-0";
const colCharging = "w-[76px] shrink-0 whitespace-nowrap px-2";
const colBattery = "w-[120px] shrink-0 px-3";

export function FleetChargingPanel({ vehicles }: FleetChargingPanelProps) {
  const charging = vehicles.filter((v) => v.snapshot?.chargingStatus === "CHARGING");
  const complete = vehicles.filter((v) => v.snapshot?.chargingStatus === "COMPLETE");

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">충전 현황</h3>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            충전중 {charging.length} · 완료 {complete.length}
          </p>
        </div>
        <Link
          href="/vehicles?filter=charging"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
        >
          전체 보기
        </Link>
      </div>

      <div className="max-w-full overflow-x-auto">
        <Table className="w-full table-fixed">
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {charging.slice(0, 5).map((vehicle) => {
              const snapshot = vehicle.snapshot;
              const chargingStatus = snapshot?.chargingStatus ?? "DISCONNECTED";

              return (
                <TableRow key={vehicle.id}>
                  <TableCell className={`px-4 py-4 ${colVehicle}`}>
                    <Link
                      href={`/vehicles/${vehicle.id}`}
                      className="flex min-w-0 items-center gap-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-light-50 dark:bg-blue-light-500/15">
                        <BoltIcon className="size-5 text-blue-light-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                          {vehicle.plateNumber}
                        </p>
                        <span className="block truncate whitespace-nowrap text-theme-xs text-gray-500 dark:text-gray-400">
                          {vehicle.model} · {vehicle.year}
                        </span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className={`py-4 ${colCharging}`}>
                    <Badge size="sm" color={chargingStatusBadgeColor(chargingStatus)}>
                      {CHARGING_STATUS_LABEL[chargingStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className={`px-3 py-4 ${colBattery}`}>
                    <BatteryProgressBar percent={snapshot?.batteryPercent} expanded />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {charging.length === 0 ? (
        <p className="py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
          현재 충전중인 차량이 없습니다.
        </p>
      ) : null}
    </div>
  );
}
