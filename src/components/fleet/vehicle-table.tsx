"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Car } from "lucide-react";

import { Badge } from "@/components/shadcn/ui/badge";
import { Button } from "@/components/shadcn/ui/button";
import { Card, CardContent } from "@/components/shadcn/ui/card";
import { Input } from "@/components/shadcn/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/ui/table";
import {
  CHARGING_STATUS_BADGE_VARIANT,
  CHARGING_STATUS_LABEL,
  STATUS_BADGE_VARIANT,
  STATUS_DOT_CLASS,
  STATUS_LABEL,
  formatDateTime,
  formatLocationSummary,
  formatOdometer,
} from "@/lib/vehicle-status";
import type { VehicleListItemDto } from "@/lib/types/vehicle";
import { cn } from "@/lib/utils";

type StatusFilter = "ALL" | "ONLINE" | "WARNING" | "ALERT" | "OFFLINE" | "IDLE" | "CHARGING";

type VehicleTableProps = {
  vehicles: VehicleListItemDto[];
  showFilters?: boolean;
  showOdometer?: boolean;
  pageSize?: number;
};

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "ONLINE", label: "정상" },
  { value: "CHARGING", label: "충전중" },
  { value: "WARNING", label: "주의" },
  { value: "ALERT", label: "이상" },
  { value: "OFFLINE", label: "오프라인" },
  { value: "IDLE", label: "미운행" },
];

export function VehicleTable({
  vehicles,
  showFilters = true,
  showOdometer = true,
  pageSize = 10,
}: VehicleTableProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
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
      return snapshot?.status === statusFilter;
    });
  }, [query, statusFilter, vehicles]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const colSpan = showOdometer ? 8 : 7;

  return (
    <div className="space-y-4">
      {showFilters ? (
        <Card className="fleet-card border-dashed shadow-none">
          <CardContent className="flex flex-col gap-3 pt-6 lg:flex-row lg:items-center lg:justify-between">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="차량 식별명 또는 모델 검색"
              className="max-w-sm focus-ring-primary"
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
                  className={cn(
                    "rounded-full border px-3 py-1 text-theme-sm transition-colors",
                    statusFilter === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="fleet-card overflow-hidden">
        <CardContent className="overflow-x-auto p-0 pt-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 bg-gray-50 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/5 dark:hover:bg-white/5">
                <TableHead className="px-4 py-3 text-theme-xs font-medium text-gray-500">
                  차량
                </TableHead>
                <TableHead className="px-4 py-3 text-theme-xs font-medium text-gray-500">
                  상태
                </TableHead>
                <TableHead className="px-4 py-3 text-theme-xs font-medium text-gray-500">
                  충전
                </TableHead>
                <TableHead className="px-4 py-3 text-theme-xs font-medium text-gray-500">
                  배터리
                </TableHead>
                <TableHead className="px-4 py-3 text-theme-xs font-medium text-gray-500">
                  주행가능
                </TableHead>
                {showOdometer ? (
                  <TableHead className="px-4 py-3 text-theme-xs font-medium text-gray-500">
                    주행거리
                  </TableHead>
                ) : null}
                <TableHead className="px-4 py-3 text-theme-xs font-medium text-gray-500">
                  위치
                </TableHead>
                <TableHead className="px-4 py-3 text-theme-xs font-medium text-gray-500">
                  최종 업데이트
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={colSpan}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    조건에 맞는 차량이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((vehicle) => {
                  const snapshot = vehicle.snapshot;
                  const status = snapshot?.status ?? "OFFLINE";
                  const chargingStatus = snapshot?.chargingStatus ?? "DISCONNECTED";

                  return (
                    <TableRow
                      key={vehicle.id}
                      className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
                    >
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10">
                            <Car className="size-4 text-gray-500 dark:text-gray-400" />
                            <span
                              className={cn(
                                "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card",
                                STATUS_DOT_CLASS[status],
                              )}
                            />
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/fleet/vehicles/${vehicle.id}`}
                              className="block truncate font-semibold text-foreground hover:text-primary"
                            >
                              {vehicle.plateNumber}
                            </Link>
                            <p className="truncate text-theme-xs text-gray-500">
                              {vehicle.model} ({vehicle.year})
                            </p>
                            {vehicle.isIdle ? (
                              <Badge variant="secondary" className="mt-1">
                                미운행
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant={STATUS_BADGE_VARIANT[status]}>
                          {STATUS_LABEL[status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant={CHARGING_STATUS_BADGE_VARIANT[chargingStatus]}>
                          {CHARGING_STATUS_LABEL[chargingStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 font-medium tabular-nums">
                        {snapshot?.batteryPercent != null
                          ? `${Math.round(snapshot.batteryPercent)}%`
                          : "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">
                        {snapshot?.rangeKm != null
                          ? `${Math.round(snapshot.rangeKm)} km`
                          : "-"}
                      </TableCell>
                      {showOdometer ? (
                        <TableCell className="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">
                          {formatOdometer(snapshot?.odometerKm ?? null)}
                        </TableCell>
                      ) : null}
                      <TableCell className="max-w-[140px] truncate px-4 py-3 text-theme-xs text-gray-500">
                        {snapshot
                          ? formatLocationSummary(snapshot.latitude, snapshot.longitude)
                          : "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-theme-sm text-gray-600 dark:text-gray-300">
                        {formatDateTime(snapshot?.lastUpdatedAt ?? null)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length > pageSize ? (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            이전
          </Button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <Button
              key={pageNumber}
              variant={pageNumber === currentPage ? "default" : "outline"}
              size="sm"
              className="min-w-9"
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            다음
          </Button>
        </div>
      ) : null}
    </div>
  );
}
