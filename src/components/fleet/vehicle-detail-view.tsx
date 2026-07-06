"use client";

import Link from "next/link";

import { VehicleMap } from "@/components/fleet/vehicle-map";
import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVehicleDetail } from "@/hooks/use-vehicles";
import { cn } from "@/lib/utils";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  formatDateTime,
} from "@/lib/vehicle-status";
import type { MapVehicle } from "@/lib/types/vehicle";

type VehicleDetailViewProps = {
  vehicleId: string;
};

export function VehicleDetailView({ vehicleId }: VehicleDetailViewProps) {
  const { data, isLoading, isError, error } = useVehicleDetail(vehicleId);

  if (isLoading) {
    return (
      <>
        <AppHeader title="차량 상세" description="데이터를 불러오는 중입니다." />
        <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <AppHeader title="차량 상세" />
        <div className="space-y-4 p-6">
          <p className="text-sm text-destructive">
            {error?.message ?? "차량 정보를 불러오지 못했습니다."}
          </p>
          <Link href="/vehicles" className={cn(buttonVariants({ variant: "outline" }))}>
            목록으로
          </Link>
        </div>
      </>
    );
  }

  const vehicle = data.vehicle;
  const snapshot = vehicle.snapshot;
  const status = snapshot?.status ?? "OFFLINE";

  const mapVehicle: MapVehicle[] = snapshot
    ? [
        {
          id: vehicle.id,
          plateNumber: vehicle.plateNumber,
          model: vehicle.model,
          status: snapshot.status,
          latitude: snapshot.latitude,
          longitude: snapshot.longitude,
          batteryPercent: snapshot.batteryPercent,
          ignitionOn: snapshot.ignitionOn,
        },
      ]
    : [];

  return (
    <>
      <AppHeader
        title={vehicle.plateNumber}
        description={`${vehicle.model} (${vehicle.year})`}
        provider={data.provider}
        lastUpdatedAt={snapshot?.lastUpdatedAt ?? null}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center gap-2">
          <Link href="/vehicles" className={cn(buttonVariants({ variant: "outline" }))}>
            목록으로
          </Link>
          <Link href="/map" className={cn(buttonVariants({ variant: "outline" }))}>
            전체 지도
          </Link>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>실시간 상태</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem label="상태">
                <Badge variant={STATUS_BADGE_VARIANT[status]}>
                  {STATUS_LABEL[status]}
                </Badge>
              </InfoItem>
              <InfoItem label="시동" value={snapshot?.ignitionOn ? "ON" : "OFF"} />
              <InfoItem
                label="배터리"
                value={
                  snapshot?.batteryPercent != null
                    ? `${Math.round(snapshot.batteryPercent)}%`
                    : "-"
                }
              />
              <InfoItem
                label="주행가능 거리"
                value={
                  snapshot?.rangeKm != null
                    ? `${Math.round(snapshot.rangeKm)} km`
                    : "-"
                }
              />
              <InfoItem
                label="위치"
                value={
                  snapshot
                    ? `${snapshot.latitude.toFixed(5)}, ${snapshot.longitude.toFixed(5)}`
                    : "-"
                }
              />
              <InfoItem
                label="최종 업데이트"
                value={formatDateTime(snapshot?.lastUpdatedAt ?? null)}
              />
              <InfoItem label="미운행" value={vehicle.isIdle ? "예" : "아니오"} />
              <InfoItem label="OEM ID" value={vehicle.oemVehicleId ?? "-"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>현재 위치</CardTitle>
            </CardHeader>
            <CardContent>
              {mapVehicle.length > 0 ? (
                <VehicleMap
                  vehicles={mapVehicle}
                  selectedId={vehicle.id}
                  height={320}
                  centerOnSelected
                />
              ) : (
                <p className="text-sm text-muted-foreground">위치 정보가 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>최근 이벤트</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {vehicle.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 이벤트가 없습니다.</p>
            ) : (
              vehicle.events.map((event) => (
                <div key={event.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{event.message}</p>
                    <Badge variant="outline">{event.type}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDateTime(event.occurredAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function InfoItem({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1 rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children ?? <p className="font-medium">{value}</p>}
    </div>
  );
}
