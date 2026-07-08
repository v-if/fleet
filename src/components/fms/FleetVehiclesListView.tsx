"use client";

import { FleetToolbar } from "@/components/fms/FleetToolbar";
import { FleetVehicleTable } from "@/components/fms/FleetVehicleTable";
import { useVehicles, useVehicleRefresh } from "@/hooks/use-vehicles";
import { formatProviderTime, providerLabel } from "@/lib/fms-badge-utils";
import { useState } from "react";

export function FleetVehiclesListView() {
  const { data, isLoading, isError, error, isFetching } = useVehicles();
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
    return <p className="text-theme-sm text-gray-500">차량 목록을 불러오는 중...</p>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 p-5 text-error-600">
        {error?.message ?? "차량 목록을 불러오지 못했습니다."}
      </div>
    );
  }

  return (
    <>
      <FleetToolbar
        title="차량 목록"
        description="플릿 전체 차량 상태를 TailAdmin 테이블로 확인합니다."
        provider={providerLabel(data.provider)}
        lastUpdatedAt={formatProviderTime(data.lastUpdatedAt)}
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing || isFetching}
      />
      <FleetVehicleTable vehicles={data.vehicles} />
    </>
  );
}
