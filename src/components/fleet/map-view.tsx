"use client";

import { useState } from "react";

import { VehicleMap } from "@/components/fleet/vehicle-map";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVehicles } from "@/hooks/use-vehicles";
import type { MapVehicle } from "@/lib/types/vehicle";

function toMapVehicles(
  vehicles: NonNullable<ReturnType<typeof useVehicles>["data"]>["vehicles"],
): MapVehicle[] {
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

export function MapView() {
  const { data, isLoading, isError, error } = useVehicles();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <>
        <AppHeader title="지도" description="데이터를 불러오는 중입니다." />
        <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <AppHeader title="지도" />
        <div className="p-6 text-sm text-destructive">
          {error?.message ?? "지도 데이터를 불러오지 못했습니다."}
        </div>
      </>
    );
  }

  const mapVehicles = toMapVehicles(data.vehicles);

  return (
    <>
      <AppHeader
        title="지도"
        description="차량 위치를 지도에서 확인하고 마커를 클릭해 요약 정보를 봅니다."
        provider={data.provider}
        lastUpdatedAt={data.lastUpdatedAt}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>실시간 차량 위치 ({mapVehicles.length}대)</CardTitle>
          </CardHeader>
          <CardContent>
            <VehicleMap
              vehicles={mapVehicles}
              selectedId={selectedId}
              onSelect={setSelectedId}
              height={560}
              centerOnSelected
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
