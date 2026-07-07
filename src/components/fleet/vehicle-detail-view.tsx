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
  CHARGING_STATUS_BADGE_VARIANT,
  CHARGING_STATUS_LABEL,
  SERVICE_STATUS_BADGE_VARIANT,
  SERVICE_STATUS_LABEL,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  formatDateTime,
  formatOdometer,
  formatTempC,
  isLowTpms,
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
  const chargingStatus = snapshot?.chargingStatus ?? "DISCONNECTED";

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
              <InfoItem label="충전">
                <Badge variant={CHARGING_STATUS_BADGE_VARIANT[chargingStatus]}>
                  {CHARGING_STATUS_LABEL[chargingStatus]}
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
                label="주행거리"
                value={formatOdometer(snapshot?.odometerKm ?? null)}
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

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>잠금 · 개폐 상태</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem label="잠금" value={snapshot?.locked ? "잠김" : "해제"} />
              <InfoItem label="문" value={snapshot?.doorsOpen ? "개방" : "닫힘"} />
              <InfoItem label="창문" value={snapshot?.windowsOpen ? "개방" : "닫힘"} />
              <InfoItem label="센트리 모드" value={snapshot?.sentryMode ? "활성" : "비활성"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>공조 · 온도</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem label="공조" value={snapshot?.climateOn ? "ON" : "OFF"} />
              <InfoItem label="실내 온도" value={formatTempC(snapshot?.insideTempC ?? null)} />
              <InfoItem label="실외 온도" value={formatTempC(snapshot?.outsideTempC ?? null)} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>타이어 공기압 (TPMS)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TpmsItem label="전좌" value={snapshot?.tpmsFrontLeft ?? null} />
              <TpmsItem label="전우" value={snapshot?.tpmsFrontRight ?? null} />
              <TpmsItem label="후좌" value={snapshot?.tpmsRearLeft ?? null} />
              <TpmsItem label="후우" value={snapshot?.tpmsRearRight ?? null} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>정비 · 소프트웨어</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem label="서비스 상태">
                {snapshot ? (
                  <Badge variant={SERVICE_STATUS_BADGE_VARIANT[snapshot.serviceStatus]}>
                    {SERVICE_STATUS_LABEL[snapshot.serviceStatus]}
                  </Badge>
                ) : (
                  <span>-</span>
                )}
              </InfoItem>
              <InfoItem
                label="펌웨어 버전"
                value={snapshot?.softwareVersion ?? "-"}
              />
            </CardContent>
          </Card>
        </div>

        {snapshot && snapshot.nearbyChargingSites.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>인근 충전소</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {snapshot.nearbyChargingSites.map((site) => (
                <div
                  key={`${site.name}-${site.distanceKm}`}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="font-medium">{site.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {site.distanceKm.toFixed(1)} km
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>최근 이벤트 · 경고</CardTitle>
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

function TpmsItem({ label, value }: { label: string; value: number | null }) {
  const low = isLowTpms(value);

  return (
    <div className="space-y-1 rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`font-medium ${low ? "text-red-600" : ""}`}>
          {value != null ? `${Math.round(value)} PSI` : "-"}
        </p>
        {low ? (
          <Badge variant="destructive" className="text-xs">
            이상
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
