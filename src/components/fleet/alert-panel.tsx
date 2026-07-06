import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  formatDateTime,
} from "@/lib/vehicle-status";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

type AlertPanelProps = {
  vehicles: VehicleListItemDto[];
};

export function AlertPanel({ vehicles }: AlertPanelProps) {
  const attention = vehicles.filter(
    (vehicle) =>
      vehicle.isIdle ||
      vehicle.snapshot?.status === "ALERT" ||
      vehicle.snapshot?.status === "WARNING" ||
      vehicle.snapshot?.status === "OFFLINE",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>이상 · 미운행 차량</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {attention.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            현재 주의가 필요한 차량이 없습니다.
          </p>
        ) : (
          attention.map((vehicle) => {
            const snapshot = vehicle.snapshot;
            const status = snapshot?.status ?? "OFFLINE";

            return (
              <Link
                key={vehicle.id}
                href={`/vehicles/${vehicle.id}`}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="space-y-1">
                  <p className="font-medium">{vehicle.plateNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {vehicle.model}
                    {vehicle.isIdle ? " · 장기 미운행" : ""}
                  </p>
                  {vehicle.recentEvents[0] ? (
                    <p className="text-sm text-muted-foreground">
                      {vehicle.recentEvents[0].message}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={STATUS_BADGE_VARIANT[status]}>
                    {STATUS_LABEL[status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(snapshot?.lastUpdatedAt ?? null)}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
