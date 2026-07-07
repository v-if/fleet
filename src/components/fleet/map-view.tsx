"use client";

import { useState } from "react";

import { VehicleMap } from "@/components/fleet/vehicle-map";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVehicles, useVehicleRefresh } from "@/hooks/use-vehicles";
import { toMapVehicles } from "@/lib/map-utils";

export function MapView() {
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
    return (
      <>
        <PageHeader
          breadcrumbs={[{ label: "지도" }]}
          title="지도"
          description="데이터를 불러오는 중입니다."
        />
        <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <PageHeader breadcrumbs={[{ label: "지도" }]} title="지도" />
        <div className="p-6 text-sm text-destructive">
          {error?.message ?? "지도 데이터를 불러오지 못했습니다."}
        </div>
      </>
    );
  }

  const mapVehicles = toMapVehicles(data.vehicles);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "지도" }]}
        title="지도"
        description="차량 위치를 지도에서 확인하고 마커를 클릭해 요약 정보를 봅니다."
        countBadge={`${mapVehicles.length}대`}
        provider={data.provider}
        lastUpdatedAt={data.lastUpdatedAt}
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing || isFetching}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Card className="overflow-hidden shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-zinc-900 to-zinc-800 text-white">
            <CardTitle>실시간 차량 위치</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <VehicleMap
              vehicles={mapVehicles}
              selectedId={selectedId}
              onSelect={setSelectedId}
              height={560}
              centerOnSelected
              hero
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
