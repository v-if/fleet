"use client";

import { useState } from "react";

import { Button } from "@/components/shadcn/ui/button";
import { VehicleTable } from "@/components/fleet/vehicle-table";
import { PageHeader } from "@/components/layout/page-header";
import { useVehicles, useVehicleRefresh } from "@/hooks/use-vehicles";

export function VehiclesListView() {
  const { data, isLoading, isError, error, isFetching } = useVehicles();
  const refreshVehicles = useVehicleRefresh();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSeedingVirtual, setIsSeedingVirtual] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refreshVehicles();
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSeedVirtualVehicles() {
    setIsSeedingVirtual(true);
    setSeedMessage(null);
    setSeedError(null);

    try {
      const response = await fetch("/api/vehicles/virtual", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { vehicleCount?: number; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "가상 차량 추가에 실패했습니다.");
      }

      await refreshVehicles();
      setSeedMessage(`가상 차량 ${payload?.vehicleCount ?? 0}대가 추가되었습니다.`);
    } catch (seedVehicleError) {
      setSeedError(
        seedVehicleError instanceof Error
          ? seedVehicleError.message
          : "가상 차량 추가에 실패했습니다.",
      );
    } finally {
      setIsSeedingVirtual(false);
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
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleSeedVirtualVehicles()}
            disabled={isSeedingVirtual}
          >
            {isSeedingVirtual ? "생성 중..." : "차량 추가(가상)"}
          </Button>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {seedMessage ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {seedMessage}
          </div>
        ) : null}
        {seedError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {seedError}
          </div>
        ) : null}
        <VehicleTable vehicles={data.vehicles} pageSize={10} />
      </div>
    </>
  );
}
