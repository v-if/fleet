"use client";

import { useState } from "react";

import { AbnormalVehiclesWidget } from "@/components/fleet/abnormal-vehicles-widget";
import { ChargingSummaryWidget } from "@/components/fleet/charging-summary-widget";
import { IdleVehiclesWidget } from "@/components/fleet/idle-vehicles-widget";
import { KpiCards } from "@/components/fleet/kpi-cards";
import { VehicleMap } from "@/components/fleet/vehicle-map";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVehicles, useVehicleRefresh } from "@/hooks/use-vehicles";
import { toMapVehicles } from "@/lib/map-utils";

export function DashboardView() {
  const { data, isLoading, isError, error, isFetching } = useVehicles();
  const refreshVehicles = useVehicleRefresh();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refreshVehicles();
    } finally {
      setIsRefreshing(false);
    }
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !data) {
    return <ErrorState message={error?.message ?? "데이터 로드 실패"} />;
  }

  const mapVehicles = toMapVehicles(data.vehicles);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "대시보드" }]}
        title="대시보드"
        description="전체 차량 현황을 지도 중심으로 한눈에 확인합니다."
        provider={data.provider}
        lastUpdatedAt={data.lastUpdatedAt}
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing || isFetching}
      />
      <div className="flex flex-1 flex-col gap-5 p-6">
        <KpiCards summary={data.summary} />

        <Card className="overflow-hidden border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-zinc-900 to-zinc-800 text-white">
            <CardTitle className="text-lg">실시간 플릿 지도</CardTitle>
            <p className="text-sm text-zinc-300">
              {mapVehicles.length}대 · 마커 색상으로 상태를 확인하세요
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <VehicleMap
              vehicles={mapVehicles}
              selectedId={selectedId}
              onSelect={setSelectedId}
              height={480}
              hero
            />
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <AbnormalVehiclesWidget
            vehicles={data.vehicles}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <IdleVehiclesWidget
            vehicles={data.vehicles}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <ChargingSummaryWidget vehicles={data.vehicles} />
      </div>
    </>
  );
}

function LoadingState() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "대시보드" }]}
        title="대시보드"
        description="데이터를 불러오는 중입니다."
      />
      <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>
    </>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "대시보드" }]} title="대시보드" />
      <div className="p-6 text-sm text-destructive">{message}</div>
    </>
  );
}
