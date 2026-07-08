import Link from "next/link";

import { Badge } from "@/components/shadcn/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/ui/card";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  formatDateTime,
  isLowTpms,
} from "@/lib/vehicle-status";
import type { VehicleListItemDto } from "@/lib/types/vehicle";

type AlertPanelProps = {
  vehicles: VehicleListItemDto[];
};

function needsAttention(vehicle: VehicleListItemDto) {
  const snapshot = vehicle.snapshot;
  if (!snapshot) return false;

  const hasAlertEvent = vehicle.recentEvents.some(
    (event) => event.type === "ALERT" || event.type === "WARNING",
  );
  const lowBattery = snapshot.batteryPercent != null && snapshot.batteryPercent < 20;
  const tpmsIssue =
    isLowTpms(snapshot.tpmsFrontLeft) ||
    isLowTpms(snapshot.tpmsFrontRight) ||
    isLowTpms(snapshot.tpmsRearLeft) ||
    isLowTpms(snapshot.tpmsRearRight);
  const securityIssue =
    snapshot.sentryMode || !snapshot.locked || snapshot.doorsOpen || snapshot.windowsOpen;

  return (
    vehicle.isIdle ||
    snapshot.status === "ALERT" ||
    snapshot.status === "WARNING" ||
    snapshot.status === "OFFLINE" ||
    hasAlertEvent ||
    lowBattery ||
    tpmsIssue ||
    securityIssue
  );
}

function getAttentionReason(vehicle: VehicleListItemDto) {
  if (vehicle.recentEvents[0]) return vehicle.recentEvents[0].message;

  const snapshot = vehicle.snapshot;
  if (!snapshot) return "상태 정보 없음";
  if (vehicle.isIdle) return "장기 미운행";
  if (snapshot.batteryPercent != null && snapshot.batteryPercent < 20) {
    return "배터리 잔량 20% 미만";
  }
  if (snapshot.sentryMode) return "센트리 모드 활성";
  if (!snapshot.locked) return "차량 잠금 해제";
  if (snapshot.doorsOpen) return "차량 문 개방";
  if (snapshot.windowsOpen) return "창문 개방";
  return "주의 필요";
}

export function AlertPanel({ vehicles }: AlertPanelProps) {
  const attention = vehicles.filter(needsAttention);

  return (
    <Card>
      <CardHeader>
        <CardTitle>이상 · 경고 · 미운행</CardTitle>
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
                href={`/fleet/vehicles/${vehicle.id}`}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="space-y-1">
                  <p className="font-medium">{vehicle.plateNumber}</p>
                  <p className="text-sm text-muted-foreground">{vehicle.model}</p>
                  <p className="text-sm text-muted-foreground">
                    {getAttentionReason(vehicle)}
                  </p>
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
