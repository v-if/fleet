"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CHARGING_STATUS_BADGE_VARIANT,
  CHARGING_STATUS_LABEL,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  formatDateTime,
  formatLocationSummary,
  formatOdometer,
} from "@/lib/vehicle-status";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

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

  const colSpan = showOdometer ? 9 : 8;

  return (
    <div className="space-y-4">
      {showFilters ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="차량 식별명 또는 모델 검색"
            className="max-w-sm"
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
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  statusFilter === option.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>차량 식별명</TableHead>
            <TableHead>모델</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>충전</TableHead>
            <TableHead>배터리</TableHead>
            <TableHead>주행가능</TableHead>
            {showOdometer ? <TableHead>주행거리</TableHead> : null}
            <TableHead>위치</TableHead>
            <TableHead>최종 업데이트</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
                조건에 맞는 차량이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            paged.map((vehicle) => {
              const snapshot = vehicle.snapshot;
              const status = snapshot?.status ?? "OFFLINE";
              const chargingStatus = snapshot?.chargingStatus ?? "DISCONNECTED";

              return (
                <TableRow key={vehicle.id} className="transition-colors hover:bg-muted/40">
                  <TableCell>
                    <Link
                      href={`/vehicles/${vehicle.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {vehicle.plateNumber}
                    </Link>
                    {vehicle.isIdle ? (
                      <Badge variant="secondary" className="ml-2">
                        미운행
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {vehicle.model}
                    <span className="text-xs"> ({vehicle.year})</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[status]}>
                      {STATUS_LABEL[status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={CHARGING_STATUS_BADGE_VARIANT[chargingStatus]}>
                      {CHARGING_STATUS_LABEL[chargingStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {snapshot?.batteryPercent != null
                      ? `${Math.round(snapshot.batteryPercent)}%`
                      : "-"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {snapshot?.rangeKm != null
                      ? `${Math.round(snapshot.rangeKm)} km`
                      : "-"}
                  </TableCell>
                  {showOdometer ? (
                    <TableCell className="tabular-nums">
                      {formatOdometer(snapshot?.odometerKm ?? null)}
                    </TableCell>
                  ) : null}
                  <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">
                    {snapshot
                      ? formatLocationSummary(snapshot.latitude, snapshot.longitude)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(snapshot?.lastUpdatedAt ?? null)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {filtered.length > pageSize ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            이전
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
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
