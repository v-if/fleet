import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">충전 · 배터리</CardTitle>
        <Link
          href="/vehicles?filter=charging"
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary"
        >
          더보기 <ChevronRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">충전중</p>
          {charging.length === 0 ? (
            <p className="text-sm text-muted-foreground">충전중인 차량이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {charging.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  href={`/vehicles/${vehicle.id}`}
                  className="flex items-center justify-between rounded-lg border p-2 transition-colors hover:bg-muted/50"
                >
                  <span className="text-sm font-medium">{vehicle.plateNumber}</span>
                  <Badge variant={CHARGING_STATUS_BADGE_VARIANT.CHARGING}>
                    {CHARGING_STATUS_LABEL.CHARGING}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">배터리 20% 미만</p>
          {lowBattery.length === 0 ? (
            <p className="text-sm text-muted-foreground">해당 차량이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {lowBattery.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  href={`/vehicles/${vehicle.id}`}
                  className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 p-2 transition-colors hover:bg-red-50"
                >
                  <span className="text-sm font-medium">{vehicle.plateNumber}</span>
                  <span className="text-sm font-semibold text-red-600">
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
