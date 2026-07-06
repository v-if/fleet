"use client";

import { AlertPanel } from "@/components/fleet/alert-panel";
import { KpiCards } from "@/components/fleet/kpi-cards";
import { VehicleMap } from "@/components/fleet/vehicle-map";
import { VehicleTable } from "@/components/fleet/vehicle-table";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVehicles } from "@/hooks/use-vehicles";
import type { MapVehicle, VehicleListItemDto } from "@/lib/types/vehicle";

function toMapVehicles(vehicles: VehicleListItemDto[]): MapVehicle[] {
  return vehicles
    .filter((vehicle) => vehicle.snapshot)
    .map((vehicle) => ({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      model: vehicle.model,
      status: vehicle.snapshot!.status,
      latitude: vehicle.snapshot!.latitude,
      longitude: vehicle.snapshot!.longitude,
      batteryPercent: vehicle.snapshot!.batteryPercent,
      ignitionOn: vehicle.snapshot!.ignitionOn,
    }));
}

export function DashboardView() {
  const { data, isLoading, isError, error, dataUpdatedAt } = useVehicles();

  if (isLoading) {
    return <LoadingState title="대시보드" />;
  }

  if (isError || !data) {
    return <ErrorState title="대시보드" message={error?.message ?? "데이터 로드 실패"} />;
  }

  const mapVehicles = toMapVehicles(data.vehicles);

  return (
    <>
      <AppHeader
        title="대시보드"
        description="전체 차량 현황을 한눈에 확인합니다."
        provider={data.provider}
        lastUpdatedAt={data.lastUpdatedAt}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <KpiCards summary={data.summary} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader>
              <CardTitle>실시간 지도</CardTitle>
            </CardHeader>
            <CardContent>
              <VehicleMap vehicles={mapVehicles} height={360} />
            </CardContent>
          </Card>
          <AlertPanel vehicles={data.vehicles} />
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>차량 목록</CardTitle>
            <p className="text-xs text-muted-foreground">
              클라이언트 갱신: {new Date(dataUpdatedAt).toLocaleTimeString("ko-KR")}
            </p>
          </CardHeader>
          <CardContent>
            <VehicleTable vehicles={data.vehicles} showFilters={false} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function LoadingState({ title }: { title: string }) {
  return (
    <>
      <AppHeader title={title} description="데이터를 불러오는 중입니다." />
      <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>
    </>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <>
      <AppHeader title={title} />
      <div className="p-6 text-sm text-destructive">{message}</div>
    </>
  );
}
