"use client";

import { useState } from "react";

import { FleetMapCard } from "@/components/fms/FleetMapCard";
import { FleetToolbar } from "@/components/fms/FleetToolbar";
import { useVehicles, useVehicleRefresh } from "@/hooks/use-vehicles";
import { formatProviderTime, providerLabel } from "@/lib/fms-badge-utils";
import { toMapVehicles } from "@/lib/map-utils";

export function FleetMapView() {
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
    return <p className="text-theme-sm text-gray-500">지도 데이터를 불러오는 중...</p>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 p-5 text-error-600">
        {error?.message ?? "지도 데이터를 불러오지 못했습니다."}
      </div>
    );
  }

  const mapVehicles = toMapVehicles(data.vehicles);

  return (
    <>
      <FleetToolbar
        title="플릿 지도"
        description="전체 차량 위치를 지도에서 확인합니다."
        provider={providerLabel(data.provider)}
        lastUpdatedAt={formatProviderTime(data.lastUpdatedAt)}
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing || isFetching}
      />
      <FleetMapCard
        vehicles={mapVehicles}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </>
  );
}
