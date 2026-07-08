import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/shadcn/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/ui/card";
import {
  CHARGING_STATUS_BADGE_VARIANT,
  CHARGING_STATUS_LABEL,
} from "@/lib/vehicle-status";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

type ChargingSummaryWidgetProps = {
  vehicles: VehicleListItemDto[];
};

export function ChargingSummaryWidget({ vehicles }: ChargingSummaryWidgetProps) {
  const charging = vehicles.filter(
    (vehicle) => vehicle.snapshot?.chargingStatus === "CHARGING",
  );
  const lowBattery = vehicles.filter(
    (vehicle) =>
      vehicle.snapshot?.batteryPercent != null && vehicle.snapshot.batteryPercent < 20,
  );

  return (
    <Card className="fleet-card fleet-card-hover">
      <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
        <CardTitle className="text-base font-semibold">충전 · 배터리</CardTitle>
        <Link
          href="/fleet/vehicles?filter=charging"
          className="flex items-center gap-0.5 text-theme-xs text-gray-500 hover:text-primary"
        >
          더보기 <ChevronRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div>
          <p className="mb-2 text-theme-xs font-medium text-gray-500">충전중</p>
          {charging.length === 0 ? (
            <p className="text-theme-sm text-muted-foreground">충전중인 차량이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {charging.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  href={`/fleet/vehicles/${vehicle.id}`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
                >
                  <div>
                    <p className="text-theme-sm font-semibold">{vehicle.plateNumber}</p>
                    <p className="text-theme-xs text-gray-500">{vehicle.model}</p>
                  </div>
                  <Badge variant={CHARGING_STATUS_BADGE_VARIANT.CHARGING}>
                    {CHARGING_STATUS_LABEL.CHARGING}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-theme-xs font-medium text-gray-500">배터리 20% 미만</p>
          {lowBattery.length === 0 ? (
            <p className="text-theme-sm text-muted-foreground">해당 차량이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {lowBattery.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  href={`/fleet/vehicles/${vehicle.id}`}
                  className="flex items-center justify-between rounded-xl border border-error-100 bg-error-50/50 p-3 transition-colors hover:bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 dark:hover:bg-error-500/15"
                >
                  <div>
                    <p className="text-theme-sm font-semibold">{vehicle.plateNumber}</p>
                    <p className="text-theme-xs text-gray-500">{vehicle.model}</p>
                  </div>
                  <span className="text-theme-sm font-semibold text-error-600 dark:text-error-500">
                    {Math.round(vehicle.snapshot!.batteryPercent!)}%
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
