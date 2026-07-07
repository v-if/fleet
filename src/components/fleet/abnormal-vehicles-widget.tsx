"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { IssueTag } from "@/components/fleet/issue-tag";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  getAttentionReason,
} from "@/lib/vehicle-status";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

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
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">이상 상태 차량</CardTitle>
        <Link
          href="/vehicles?filter=abnormal"
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary"
        >
          더보기 <ChevronRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <CountBox label="연결 이상" count={counts.offline} tone="offline" />
          <CountBox label="운행 주의" count={counts.warning} tone="warning" />
          <CountBox label="차량 이상" count={counts.alert} tone="alert" />
        </div>
        <div className="max-h-52 space-y-2 overflow-y-auto">
          {abnormal.length === 0 ? (
            <p className="text-sm text-muted-foreground">이상 차량이 없습니다.</p>
          ) : (
            abnormal.map((vehicle) => {
              const status = vehicle.snapshot?.status ?? "OFFLINE";
              const selected = selectedId === vehicle.id;

              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => onSelect?.(vehicle.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-all duration-200 hover:bg-muted/50 ${
                    selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">{vehicle.plateNumber}</p>
                      <p className="text-xs text-muted-foreground">{vehicle.model}</p>
                      <IssueTag
                        label={getAttentionReason(vehicle)}
                        variant={status === "ALERT" ? "alert" : "warning"}
                      />
                    </div>
                    <Badge variant={STATUS_BADGE_VARIANT[status]}>
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
    offline: "bg-zinc-100 text-zinc-700",
    warning: "bg-amber-50 text-amber-700",
    alert: "bg-red-50 text-red-700",
  };

  return (
    <div className={`rounded-lg px-3 py-2 text-center ${toneClass[tone]}`}>
      <p className="text-2xl font-semibold tabular-nums">{count}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}
