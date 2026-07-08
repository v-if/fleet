"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/shadcn/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/ui/card";
import {
  formatLocationSummary,
  getIdleDurationLabel,
  IDLE_DAYS_THRESHOLD,
  isIdleForDays,
} from "@/lib/vehicle-status";
import type { VehicleListItemDto } from "@/lib/types/vehicle";
import { cn } from "@/lib/utils";

type IdleVehiclesWidgetProps = {
  vehicles: VehicleListItemDto[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

export function IdleVehiclesWidget({
  vehicles,
  selectedId,
  onSelect,
}: IdleVehiclesWidgetProps) {
  const [daysThreshold, setDaysThreshold] = useState(IDLE_DAYS_THRESHOLD);

  const idle = vehicles.filter((vehicle) => {
    if (!vehicle.snapshot) return false;
    return isIdleForDays(
      vehicle.snapshot.status,
      vehicle.snapshot.lastUpdatedAt,
      daysThreshold,
    );
  });

  return (
    <Card className="fleet-card fleet-card-hover">
      <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
        <CardTitle className="text-base font-semibold">장기 미운행</CardTitle>
        <Link
          href="/fleet/vehicles?filter=idle"
          className="flex items-center gap-0.5 text-theme-xs text-gray-500 hover:text-primary"
        >
          더보기 <ChevronRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">{idle.length}대</Badge>
          <select
            value={daysThreshold}
            onChange={(event) => setDaysThreshold(Number(event.target.value))}
            className="rounded-lg border border-gray-200 bg-background px-2 py-1 text-theme-xs focus-ring-primary dark:border-gray-700"
          >
            <option value={7}>7일 이상</option>
            <option value={30}>30일 이상</option>
          </select>
        </div>
        <div className="custom-scrollbar max-h-52 space-y-2 overflow-y-auto">
          {idle.length === 0 ? (
            <p className="text-theme-sm text-muted-foreground">미운행 차량이 없습니다.</p>
          ) : (
            idle.map((vehicle) => {
              const snapshot = vehicle.snapshot;
              const selected = selectedId === vehicle.id;

              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => onSelect?.(vehicle.id)}
                  className={cn(
                    "w-full rounded-xl border border-gray-200 p-3 text-left transition-all duration-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5",
                    selected && "border-primary bg-primary/5 ring-1 ring-primary/30",
                  )}
                >
                  <p className="font-semibold">{vehicle.plateNumber}</p>
                  <p className="text-theme-xs text-gray-500">
                    {vehicle.model} · {getIdleDurationLabel(snapshot?.lastUpdatedAt ?? null)} 미운행
                  </p>
                  {snapshot ? (
                    <p className="mt-1 text-theme-xs text-gray-500">
                      {formatLocationSummary(snapshot.latitude, snapshot.longitude)}
                    </p>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
