"use client";

import { useState } from "react";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { FleetAttentionPanel } from "@/components/fms/FleetAttentionPanel";
import { FleetChargingPanel } from "@/components/fms/FleetChargingPanel";
import { FleetMapCard } from "@/components/fms/FleetMapCard";
import { FleetMetrics } from "@/components/fms/FleetMetrics";
import { FleetRecentVehicles } from "@/components/fms/FleetRecentVehicles";
import { FleetToolbar } from "@/components/fms/FleetToolbar";
import { useVehicles, useVehicleRefresh } from "@/hooks/use-vehicles";
import { formatProviderTime, providerLabel } from "@/lib/fms-badge-utils";
import { toMapVehicles } from "@/lib/map-utils";

export function FleetDashboardView() {
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
        <PageBreadcrumb pageTitle="Fleet Dashboard" />
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">데이터를 불러오는 중...</p>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <PageBreadcrumb pageTitle="Fleet Dashboard" />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-5 text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500">
          {error?.message ?? "대시보드 데이터를 불러오지 못했습니다."}
        </div>
      </>
    );
  }

  const mapVehicles = toMapVehicles(data.vehicles);

  return (
    <>
      <FleetToolbar
        title="Fleet Dashboard"
        description="전체 차량 현황을 TailAdmin 대시보드에서 확인합니다."
        provider={providerLabel(data.provider)}
        lastUpdatedAt={formatProviderTime(data.lastUpdatedAt)}
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing || isFetching}
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch md:gap-6">
          <FleetMetrics summary={data.summary} />
          <FleetMapCard
            vehicles={mapVehicles}
            selectedId={selectedId}
            onSelect={setSelectedId}
            fillHeight
            mapHeight={400}
          />
        </div>

        <div className="col-span-12">
          <FleetAttentionPanel
            vehicles={data.vehicles}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <FleetChargingPanel vehicles={data.vehicles} />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <FleetRecentVehicles vehicles={data.vehicles} />
        </div>
      </div>
    </>
  );
}
