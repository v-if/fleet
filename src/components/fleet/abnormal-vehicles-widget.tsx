"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { IssueTag } from "@/components/fleet/issue-tag";
import { Badge } from "@/components/shadcn/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/ui/card";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  getAttentionReason,
} from "@/lib/vehicle-status";
import type { VehicleListItemDto } from "@/lib/types/vehicle";
import { cn } from "@/lib/utils";

type AbnormalVehiclesWidgetProps = {
  vehicles: VehicleListItemDto[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function countByCategory(vehicles: VehicleListItemDto[]) {
  let offline = 0;
  let warning = 0;
  let alert = 0;

  for (const vehicle of vehicles) {
    const status = vehicle.snapshot?.status;
    if (status === "OFFLINE") offline++;
    else if (status === "WARNING") warning++;
    else if (status === "ALERT") alert++;
  }

  return { offline, warning, alert };
}

export function AbnormalVehiclesWidget({
  vehicles,
  selectedId,
  onSelect,
}: AbnormalVehiclesWidgetProps) {
  const counts = countByCategory(vehicles);
  const abnormal = vehicles.filter((vehicle) => {
    const status = vehicle.snapshot?.status;
    return status === "OFFLINE" || status === "WARNING" || status === "ALERT";
  });

  return (
    <Card className="fleet-card fleet-card-hover">
      <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
        <CardTitle className="text-base font-semibold">이상 상태 차량</CardTitle>
        <Link
          href="/fleet/vehicles?filter=abnormal"
          className="flex items-center gap-0.5 text-theme-xs text-gray-500 hover:text-primary"
        >
          더보기 <ChevronRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          <CountBox label="연결 이상" count={counts.offline} tone="offline" />
          <CountBox label="운행 주의" count={counts.warning} tone="warning" />
          <CountBox label="차량 이상" count={counts.alert} tone="alert" />
        </div>
        <div className="custom-scrollbar max-h-52 space-y-2 overflow-y-auto">
          {abnormal.length === 0 ? (
            <p className="text-theme-sm text-muted-foreground">이상 차량이 없습니다.</p>
          ) : (
            abnormal.map((vehicle) => {
              const status = vehicle.snapshot?.status ?? "OFFLINE";
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold">{vehicle.plateNumber}</p>
                      <p className="truncate text-theme-xs text-gray-500">
                        {vehicle.model} · {STATUS_LABEL[status]}
                      </p>
                      <IssueTag
                        label={getAttentionReason(vehicle)}
                        variant={status === "ALERT" ? "alert" : "warning"}
                      />
                    </div>
                    <Badge variant={STATUS_BADGE_VARIANT[status]} className="shrink-0">
                      {STATUS_LABEL[status]}
                    </Badge>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CountBox({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "offline" | "warning" | "alert";
}) {
  const toneClass = {
    offline: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
    warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500",
    alert: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  };

  return (
    <div className={cn("rounded-xl px-3 py-2 text-center", toneClass[tone])}>
      <p className="text-title-sm font-bold tabular-nums leading-none">{count}</p>
      <p className="mt-1 text-theme-xs">{label}</p>
    </div>
  );
}
