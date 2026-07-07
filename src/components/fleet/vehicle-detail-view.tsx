"use client";

import Link from "next/link";
import { useState } from "react";

import { BatteryHealthGauge } from "@/components/fleet/battery-health-gauge";
import { IssueTag } from "@/components/fleet/issue-tag";
import { TpmsDiagram } from "@/components/fleet/tpms-diagram";
import { VehicleMap } from "@/components/fleet/vehicle-map";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/layout/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVehicleDetail, useVehicleRefresh } from "@/hooks/use-vehicles";
import { cn } from "@/lib/utils";
import {
  CHARGING_STATUS_BADGE_VARIANT,
  CHARGING_STATUS_LABEL,
  SERVICE_STATUS_BADGE_VARIANT,
  SERVICE_STATUS_LABEL,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  formatDateTime,
  formatLocationSummary,
  formatOdometer,
  formatTempC,
  isLowTpms,
} from "@/lib/vehicle-status";
import type { MapVehicle, VehicleDetailDto } from "@/lib/types/vehicle";

type VehicleDetailViewProps = {
  vehicleId: string;
};

type IssueTagItem = {
  label: string;
  variant: "warning" | "alert" | "info";
};

const ATM_TO_PSI = 14.7;

function convertTeslaTpmsToPsi(value: number | null, provider: string) {
  if (value == null) return null;
  if (provider !== "tesla") return value;
  return value * ATM_TO_PSI;
}

function collectIssueTags(vehicle: VehicleDetailDto): IssueTagItem[] {
  const snapshot = vehicle.snapshot;
  const tags: IssueTagItem[] = [];

  if (!snapshot) return tags;

  if (snapshot.batteryPercent != null && snapshot.batteryPercent < 20) {
    tags.push({ label: "배터리 20% 미만", variant: "alert" });
  }
  if (!snapshot.locked) tags.push({ label: "잠금 해제", variant: "warning" });
  if (snapshot.doorsOpen) tags.push({ label: "문 개방", variant: "warning" });
  if (snapshot.windowsOpen) tags.push({ label: "창문 개방", variant: "warning" });
  if (snapshot.sentryMode) tags.push({ label: "센트리 모드", variant: "info" });
  if (isLowTpms(snapshot.tpmsFrontLeft)) {
    tags.push({ label: "TPMS 전좌 이상", variant: "alert" });
  }
  if (isLowTpms(snapshot.tpmsFrontRight)) {
    tags.push({ label: "TPMS 전우 이상", variant: "alert" });
  }
  if (isLowTpms(snapshot.tpmsRearLeft)) {
    tags.push({ label: "TPMS 후좌 이상", variant: "alert" });
  }
  if (isLowTpms(snapshot.tpmsRearRight)) {
    tags.push({ label: "TPMS 후우 이상", variant: "alert" });
  }

  for (const event of vehicle.events.slice(0, 3)) {
    tags.push({
      label: event.message,
      variant: event.type === "ALERT" ? "alert" : "warning",
    });
  }

  const unique = new Map<string, IssueTagItem>();
  for (const tag of tags) {
    unique.set(tag.label, tag);
  }
  return Array.from(unique.values());
}

export function VehicleDetailView({ vehicleId }: VehicleDetailViewProps) {
  const { data, isLoading, isError, error, isFetching } = useVehicleDetail(vehicleId);
  const refreshVehicles = useVehicleRefresh();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refreshVehicles();
    } finally {
      setIsRefreshing(false);
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHeader
          breadcrumbs={[
            { label: "차량", href: "/vehicles" },
            { label: "차량 목록", href: "/vehicles" },
            { label: "차량 상세" },
          ]}
          title="차량 상세"
          description="데이터를 불러오는 중입니다."
        />
        <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <PageHeader
          breadcrumbs={[
            { label: "차량", href: "/vehicles" },
            { label: "차량 목록", href: "/vehicles" },
            { label: "차량 상세" },
          ]}
          title="차량 상세"
        />
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
  const issueTags = collectIssueTags(vehicle);

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
          chargingStatus: snapshot.chargingStatus,
        },
      ]
    : [];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "차량", href: "/vehicles" },
          { label: "차량 목록", href: "/vehicles" },
          { label: vehicle.plateNumber },
        ]}
        title={vehicle.plateNumber}
        description={`${vehicle.model} (${vehicle.year})`}
        provider={data.provider}
        lastUpdatedAt={snapshot?.lastUpdatedAt ?? null}
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing || isFetching}
        actions={
          <Button variant="outline" size="sm" disabled title="Phase 3 이후 제공">
            제어
          </Button>
        }
      />

      <div className="border-b bg-muted/30 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={STATUS_BADGE_VARIANT[status]} className="text-sm">
            {STATUS_LABEL[status]}
          </Badge>
          <Badge variant={CHARGING_STATUS_BADGE_VARIANT[chargingStatus]}>
            {CHARGING_STATUS_LABEL[chargingStatus]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            배터리{" "}
            <strong className="text-foreground">
              {snapshot?.batteryPercent != null
                ? `${Math.round(snapshot.batteryPercent)}%`
                : "-"}
            </strong>
          </span>
          <span className="text-sm text-muted-foreground">
            시동 <strong className="text-foreground">{snapshot?.ignitionOn ? "ON" : "OFF"}</strong>
          </span>
          {issueTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {issueTags.slice(0, 4).map((tag) => (
                <IssueTag key={tag.label} label={tag.label} variant={tag.variant} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center gap-2">
          <Link href="/vehicles" className={cn(buttonVariants({ variant: "outline" }))}>
            목록으로
          </Link>
          <Link href="/map" className={cn(buttonVariants({ variant: "outline" }))}>
            전체 지도
          </Link>
        </div>

        <Tabs defaultValue="home">
          <TabsList>
            <TabsTrigger value="home">홈</TabsTrigger>
            <TabsTrigger value="events">이벤트</TabsTrigger>
          </TabsList>

          <TabsContent value="home">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle>배터리 · 주행</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <BatteryHealthGauge
                    percent={snapshot?.batteryPercent ?? null}
                    rangeKm={snapshot?.rangeKm ?? null}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoItem
                      label="주행거리"
                      value={formatOdometer(snapshot?.odometerKm ?? null)}
                    />
                    <InfoItem
                      label="미운행"
                      value={vehicle.isIdle ? "예" : "아니오"}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle>현재 위치</CardTitle>
                </CardHeader>
                <CardContent>
                  {mapVehicle.length > 0 ? (
                    <VehicleMap
                      vehicles={mapVehicle}
                      selectedId={vehicle.id}
                      height={280}
                      centerOnSelected
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">위치 정보가 없습니다.</p>
                  )}
                  {snapshot ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatLocationSummary(snapshot.latitude, snapshot.longitude)}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {issueTags.length > 0 ? (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>경고 항목</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {issueTags.map((tag) => (
                    <IssueTag key={tag.label} label={tag.label} variant={tag.variant} />
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>잠금 · 개폐</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <InfoItem label="잠금" value={snapshot?.locked ? "잠김" : "해제"} />
                  <InfoItem label="문" value={snapshot?.doorsOpen ? "개방" : "닫힘"} />
                  <InfoItem label="창문" value={snapshot?.windowsOpen ? "개방" : "닫힘"} />
                  <InfoItem
                    label="센트리"
                    value={snapshot?.sentryMode ? "활성" : "비활성"}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>공조 · 온도</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <InfoItem label="공조" value={snapshot?.climateOn ? "ON" : "OFF"} />
                  <InfoItem
                    label="실내"
                    value={formatTempC(snapshot?.insideTempC ?? null)}
                  />
                  <InfoItem
                    label="실외"
                    value={formatTempC(snapshot?.outsideTempC ?? null)}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>타이어 공기압 (TPMS)</CardTitle>
                </CardHeader>
                <CardContent>
                  <TpmsDiagram
                    frontLeft={convertTeslaTpmsToPsi(snapshot?.tpmsFrontLeft ?? null, data.provider)}
                    frontRight={convertTeslaTpmsToPsi(
                      snapshot?.tpmsFrontRight ?? null,
                      data.provider,
                    )}
                    rearLeft={convertTeslaTpmsToPsi(snapshot?.tpmsRearLeft ?? null, data.provider)}
                    rearRight={convertTeslaTpmsToPsi(snapshot?.tpmsRearRight ?? null, data.provider)}
                  />
                  {data.provider === "tesla" ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Tesla TPMS 원본값은 atm(또는 bar에 준하는 압력 단위) 기준으로 간주하고,
                      화면에는 1 atm ≒ 14.7 PSI 환산값을 표시합니다.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>정비 · 소프트웨어</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <InfoItem label="서비스">
                    {snapshot ? (
                      <Badge variant={SERVICE_STATUS_BADGE_VARIANT[snapshot.serviceStatus]}>
                        {SERVICE_STATUS_LABEL[snapshot.serviceStatus]}
                      </Badge>
                    ) : (
                      <span>-</span>
                    )}
                  </InfoItem>
                  <InfoItem
                    label="펌웨어"
                    value={snapshot?.softwareVersion ?? "-"}
                  />
                </CardContent>
              </Card>
            </div>

            {snapshot && snapshot.nearbyChargingSites.length > 0 ? (
              <Card className="mt-6">
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
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>이벤트 타임라인</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {vehicle.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">등록된 이벤트가 없습니다.</p>
                ) : (
                  vehicle.events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                    >
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
          </TabsContent>
        </Tabs>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
          <span>
            마지막 업데이트{" "}
            <time className="font-medium text-foreground">
              {formatDateTime(snapshot?.lastUpdatedAt ?? null)}
            </time>
          </span>
          <RefreshButton onClick={() => void handleRefresh()} isRefreshing={isRefreshing || isFetching} />
        </footer>
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
    <div className="space-y-1 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children ?? <p className="font-medium">{value}</p>}
    </div>
  );
}
