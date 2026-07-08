"use client";

import { useState } from "react";

import { VehicleTable } from "@/components/fleet/vehicle-table";
import { PageHeader } from "@/components/layout/page-header";
import { useVehicles, useVehicleRefresh } from "@/hooks/use-vehicles";

export function VehiclesListView() {
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
    return (
      <>
        <PageHeader
          breadcrumbs={[
            { label: "차량", href: "/fleet/vehicles" },
            { label: "차량 목록" },
          ]}
          title="차량 목록"
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
            { label: "차량", href: "/fleet/vehicles" },
            { label: "차량 목록" },
          ]}
          title="차량 목록"
        />
        <div className="p-6 text-sm text-destructive">
          {error?.message ?? "차량 목록을 불러오지 못했습니다."}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "차량", href: "/fleet/vehicles" },
          { label: "차량 목록" },
        ]}
        title="차량 목록"
        description="차량번호·상태·충전·미운행으로 검색하고 필터링합니다."
        countBadge={`총 ${data.count}건`}
        provider={data.provider}
        lastUpdatedAt={data.lastUpdatedAt}
        onRefresh={() => void handleRefresh()}
        isRefreshing={isRefreshing || isFetching}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <VehicleTable vehicles={data.vehicles} pageSize={10} />
      </div>
    </>
  );
}
